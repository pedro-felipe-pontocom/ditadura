// A serra desenhada pela voz.
//
// O AnalyserNode entrega o espectro do som a cada quadro. Dividimos o espectro em
// faixas (escala logarítmica, ~90 Hz a 5 kHz) e cada faixa levanta um trecho da
// crista: a nota grave ergue morros à esquerda, o falsete ergue picos à direita.
// A cada ~0,8 s a crista atual é "empurrada" para trás e vira uma camada mais
// distante, mais alta e mais clara, como o mar de morros de Minas. Sem som,
// tudo volta a ser uma linha reta de horizonte.

import { clamp, lerp, mulberry32, movimentoReduzido } from "./util.js";

// Geometria de cada modo (frações da altura da tela).
const MODOS = {
  serra: { base: 0.865, amp: 0.28, gap: 0.027, hist: 1, traco: 1.6, alfa: 1 },
  linha: { base: 0.992, amp: 0.075, gap: 0, hist: 0, traco: 1.25, alfa: 0.75 },
};

// Cores por tema: frente (crista viva) e fundo (camadas distantes).
const CORES = {
  papel: { frente: [112, 56, 28], fundo: [196, 158, 128], bg: [235, 228, 214] },
  tarja: { frente: [226, 158, 112], fundo: [92, 54, 34], bg: [15, 14, 12] },
};

const misturar = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const suave = (t) => t * t * (3 - 2 * t);

export class Voz {
  constructor(canvas, audio, cfg = {}, { estatico = false } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d");
    this.audio = audio;
    this.estatico = estatico;
    this.B = cfg.bandas || 46;
    this.fMin = cfg.freqMin || 90;
    this.fMax = cfg.freqMax || 5200;
    this.L = cfg.camadas || 9;
    this.intervalo = cfg.intervaloCamadaMs || 820;

    this.niveis = new Float32Array(this.B);
    this.picos = new Float32Array(this.B).fill(0.25);
    this.energia = 0;
    this.historico = []; // [{ h: Float32Array, max }]
    this.ultimoEmpurrao = 0;
    this.ultimoQuadro = 0;

    // Relevo fixo: deixa os morros arredondados e variados mesmo com som uniforme.
    const r = mulberry32(1942);
    this.relevo = Float32Array.from({ length: this.B }, (_, i) => {
      const x = i / (this.B - 1);
      const envelope = Math.pow(Math.sin(Math.PI * clamp(x * 0.96 + 0.02, 0, 1)), 0.55);
      return envelope * (0.62 + 0.38 * r());
    });
    // Rugosidade da crista (pequenos dentes de serra), também fixa.
    this.rugas = Float32Array.from({ length: this.B * 3 }, () => r() * 2 - 1);

    this.param = { ...MODOS.linha };
    this.paramIni = { ...MODOS.linha };
    this.alvo = MODOS.linha;
    this.tTrans = 0;
    this.cores = CORES.papel;

    this.redimensionar();
    addEventListener("resize", () => {
      this.redimensionar();
      if (this.estatico) this.desenhar(performance.now());
    });
  }

  redimensionar() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(innerWidth * this.dpr);
    this.canvas.height = Math.round(innerHeight * this.dpr);
  }

  definirModo(nome, tema) {
    this.paramIni = { ...this.param };
    this.alvo = MODOS[nome] || MODOS.linha;
    this.tTrans = performance.now();
    this.cores = CORES[tema] || CORES.papel;
    if (this.estatico) {
      this.param = { ...this.alvo };
      this.desenhar(performance.now());
    }
  }

  iniciar() {
    if (this.estatico) {
      this.desenhar(performance.now());
      return;
    }
    const quadro = (t) => {
      // Movimento reduzido: atualiza poucas vezes por segundo, sem deriva das camadas.
      if (!movimentoReduzido() || t - this.ultimoQuadro > 250) {
        this.ultimoQuadro = t;
        this.atualizar(t);
        this.desenhar(t);
      }
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  /* ------------------------------------------------------------ análise */

  atualizar(t) {
    const au = this.audio;
    const an = au?.analisador;
    const B = this.B;
    let alvoEnergia = 0;
    const alvo = this.alvoNiveis || (this.alvoNiveis = new Float32Array(B));

    if (an && (au.tocando || this.energia > 0.002)) {
      if (!this.freq) {
        this.freq = new Uint8Array(an.frequencyBinCount);
        this.onda = new Float32Array(an.fftSize);
      }
      an.getByteFrequencyData(this.freq);
      an.getFloatTimeDomainData(this.onda);
      let soma = 0;
      for (let i = 0; i < this.onda.length; i++) soma += this.onda[i] * this.onda[i];
      const rms = Math.sqrt(soma / this.onda.length);
      alvoEnergia = clamp(rms * 4.2, 0, 1);

      const nyquist = (au.ctx?.sampleRate || 44100) / 2;
      const bins = this.freq.length;
      for (let b = 0; b < B; b++) {
        const f0 = this.fMin * Math.pow(this.fMax / this.fMin, b / B);
        const f1 = this.fMin * Math.pow(this.fMax / this.fMin, (b + 1) / B);
        const i0 = Math.floor((f0 / nyquist) * bins);
        const i1 = Math.max(i0 + 1, Math.ceil((f1 / nyquist) * bins));
        let s = 0;
        for (let i = i0; i < i1; i++) s += this.freq[i];
        const v = s / (i1 - i0) / 255;
        // Controle automático de ganho por faixa: trechos baixinhos também desenham.
        this.picos[b] = Math.max(v, this.picos[b] * 0.9965, 0.12);
        alvo[b] = clamp((v - 0.06) / (this.picos[b] - 0.06), 0, 1);
      }
    } else if (au?.modo === "youtube" && au.tocando) {
      // Sem acesso ao som do iframe: só uma respiração lenta, sem fingir que é a voz.
      alvoEnergia = 0.32;
      for (let b = 0; b < B; b++) {
        alvo[b] = 0.35 + 0.25 * Math.sin(t * 0.0006 + b * 0.37) * Math.sin(t * 0.00023 + b * 0.11);
      }
    } else {
      alvo.fill(0);
    }

    // Ataque rápido, soltura lenta: a crista sobe com a voz e desce devagar.
    for (let b = 0; b < B; b++) {
      const atual = this.niveis[b];
      this.niveis[b] = atual + (alvo[b] - atual) * (alvo[b] > atual ? 0.42 : 0.075);
    }
    this.energia += (alvoEnergia - this.energia) * (alvoEnergia > this.energia ? 0.22 : 0.04);

    // Empurra a crista atual para o fundo.
    if (this.param.hist > 0.01 && !movimentoReduzido() && t - this.ultimoEmpurrao > this.intervalo) {
      this.ultimoEmpurrao = t;
      const h = new Float32Array(B);
      let max = 0;
      for (let b = 0; b < B; b++) {
        h[b] = this.altura(b);
        if (h[b] > max) max = h[b];
      }
      this.historico.unshift({ h, max });
      if (this.historico.length > this.L) this.historico.length = this.L;
    }
  }

  // Altura normalizada (0..1) da faixa b na crista viva.
  altura(b) {
    return Math.pow(this.niveis[b], 1.25) * Math.pow(this.energia, 0.75) * this.relevo[b];
  }

  /* ------------------------------------------------------------- desenho */

  desenhar(t) {
    const { g, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const k = suave(clamp((t - this.tTrans) / 1300, 0, 1));
    for (const chave of Object.keys(this.alvo)) {
      this.param[chave] = lerp(this.paramIni[chave], this.alvo[chave], k);
    }
    const p = this.param;
    const cores = this.cores;
    g.clearRect(0, 0, W, H);

    const baseY = p.base * H;
    const A = p.amp * H;
    const respiro = 1 + 0.025 * Math.sin(t * 0.0011) * this.energia;

    // Camadas distantes, de trás para a frente.
    if (p.hist > 0.01 && this.historico.length) {
      const fase = movimentoReduzido() ? 0 : clamp((t - this.ultimoEmpurrao) / this.intervalo, 0, 1);
      for (let i = this.historico.length - 1; i >= 0; i--) {
        const camada = this.historico[i];
        const d = i + fase;
        const prof = d / this.L;
        if (prof >= 1) continue;
        const visivel = clamp(camada.max * 4, 0, 1) * Math.pow(1 - prof, 1.3) * p.hist;
        if (visivel < 0.01) continue;
        const y0 = baseY - p.gap * H * d;
        const escala = (1 - prof * 0.38) * respiro;
        const cor = misturar(cores.frente, cores.fundo, Math.pow(prof, 0.8));
        this.tracar(camada.h, y0, A * escala, W, H, rgba(cor, visivel * p.alfa), (p.traco * (1 - prof * 0.45)) * this.dpr, true);
      }
    }

    // Crista viva.
    const viva = this.vivaBuf || (this.vivaBuf = new Float32Array(this.B));
    for (let b = 0; b < this.B; b++) viva[b] = this.altura(b);
    this.tracar(viva, baseY, A * respiro, W, H, rgba(cores.frente, p.alfa), p.traco * this.dpr, p.hist > 0.01);
  }

  // Desenha uma crista: pontos interpolados + rugosidade + curva suave (Catmull-Rom).
  tracar(h, y0, A, W, H, cor, largura, preencher) {
    const g = this.g;
    const B = this.B;
    const n = B * 3;
    const pts = [{ x: -0.02 * W, y: y0 }];
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * (B - 1);
      const b0 = Math.floor(u);
      const b1 = Math.min(B - 1, b0 + 1);
      const v = lerp(h[b0], h[b1], u - b0);
      const ruga = 1 + this.rugas[i] * 0.12;
      pts.push({ x: (i / (n - 1)) * W, y: y0 - A * v * ruga });
    }
    pts.push({ x: 1.02 * W, y: y0 });

    const crista = new Path2D();
    crista.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      crista.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6,
        p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,
        p2.y - (p3.y - p1.y) / 6,
        p2.x,
        p2.y,
      );
    }
    if (preencher) {
      // Preenche com a cor do fundo para esconder as camadas de trás (oclusão).
      const area = new Path2D(crista);
      area.lineTo(1.02 * W, H);
      area.lineTo(-0.02 * W, H);
      area.closePath();
      g.fillStyle = rgba(this.cores.bg, 1);
      g.fill(area);
    }
    g.strokeStyle = cor;
    g.lineWidth = largura;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.stroke(crista);
  }
}
