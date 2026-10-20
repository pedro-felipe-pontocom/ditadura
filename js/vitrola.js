// A vitrola (abertura e silêncio final).
// Primeiro clique: o disco sai da capa, vai para o prato, o braço desce, a agulha
// estala e a música começa. O disco gira a 33⅓ rpm enquanto toca, e o braço avança
// devagar para o centro conforme a faixa anda, como num toca-discos de verdade.
// Todas as vitrolas da apresentação mostram o mesmo estado (é um disco só).

import { el, clamp, movimentoReduzido } from "./util.js";

const GRAUS_POR_MS = ((100 / 3) * 360) / 60000; // 33⅓ rotações por minuto
const BRACO_REPOUSO = 0;
const BRACO_BORDA = 30; // agulha na borda do disco (início da faixa)
const BRACO_CENTRO = 44; // agulha perto do selo (fim da faixa)
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let contador = 0;

function svgDisco(id) {
  const sulcos = [];
  for (let r = 19; r <= 47.5; r += 1.25) sulcos.push(`<circle r="${r}"/>`);
  return `<svg viewBox="-50 -50 100 100" aria-hidden="true">
    <circle r="49.6" fill="#121110" stroke="#34302b" stroke-width=".7"/>
    <g fill="none" stroke="#ebe4d6" stroke-opacity=".075" stroke-width=".32">${sulcos.join("")}</g>
    <g fill="none" stroke="#ebe4d6" stroke-opacity=".16" stroke-width=".7"><circle r="29.5"/><circle r="38.6"/></g>
    <circle r="17" fill="#8e4f2c"/>
    <defs><path id="arco-${id}" d="M-13.4,0a13.4,13.4 0 1,1 26.8,0a13.4,13.4 0 1,1 -26.8,0"/></defs>
    <text fill="#f4ebde" font-family="'Big Shoulders Display', sans-serif" font-weight="700" font-size="2.9" letter-spacing=".5"><textPath href="#arco-${id}">MILAGRE DOS PEIXES · LADO B · FAIXA 3 · EMI-ODEON 1973 ·</textPath></text>
    <text fill="#f4ebde" font-family="Newsreader, serif" font-style="italic" font-size="4.2" text-anchor="middle" y="-4.2">Hoje é Dia</text>
    <text fill="#f4ebde" font-family="Newsreader, serif" font-style="italic" font-size="4.2" text-anchor="middle" y="8">de El-Rey</text>
    <circle r="1.5" fill="#d9d0bf"/>
  </svg>`;
}

const SVG_BRACO = `<svg viewBox="0 0 4 16" aria-hidden="true">
  <rect class="vt-peso" x="1.12" y=".1" width="1.76" height="1.3" rx=".2"/>
  <line class="vt-haste" x1="2" y1="1.4" x2="2" y2="12.3"/>
  <circle class="vt-pivo" cx="2" cy="2.4" r="1.05"/>
  <path class="vt-cabeca" d="M1.42 12.05L2.58 12.05L2.36 14.05L1.2 14.05Z"/>
</svg>`;

export class Vitrolas {
  constructor(audio) {
    this.audio = audio;
    this.vistas = [];
    this.noPrato = false; // o disco já saiu da capa?
    this.bracoNoDisco = false;
    this.girar = false;
    this.ocupado = false; // no meio da sequência capa → prato → agulha
    this.aguardarAte = 0; // o YouTube demora para começar; não levanta o braço antes disso
    this.angulo = 0;
    this.vel = 0;
    this.braco = BRACO_REPOUSO;
    this.tAnterior = 0;
    audio?.aoMudar(() => this.sincronizar());
    requestAnimationFrame(this.quadro);
  }

  /** Cria uma vitrola (com a capa ao lado) e devolve o elemento. */
  criar(textos = {}) {
    const id = `v${++contador}`;
    const disco = el("div", { class: "vt-disco", html: svgDisco(id) });
    const braco = el("div", { class: "vt-braco", html: SVG_BRACO });
    const raiz = el(
      "div",
      { class: "vitrola", "data-acao": "vitrola", role: "button", "aria-label": "Vitrola: clique para tocar ou parar o disco" },
      el(
        "div",
        { class: "vt-base", "aria-hidden": "true" },
        el("div", { class: "vt-prato" }),
        el("span", { class: "vt-liga" }),
        el("span", { class: "vt-rpm", text: "33⅓" }),
      ),
      el("div", { class: "vt-disco-pos" }, disco, el("div", { class: "vt-brilho" })),
      el(
        "div",
        { class: "vt-capa", "aria-hidden": "true" },
        el("span", { class: "vt-capa-autor", text: textos.autor || "" }),
        el("span", { class: "vt-capa-titulo", text: textos.titulo || "" }),
        el("span", { class: "vt-capa-ano", text: textos.ano || "" }),
      ),
      braco,
    );
    const vista = { raiz, disco, braco };
    this.vistas.push(vista);
    raiz.classList.toggle("no-prato", this.noPrato);
    return raiz;
  }

  visivel() {
    return this.vistas.some((v) => v.raiz.closest(".slide.is-active"));
  }

  marcarPrato() {
    for (const v of this.vistas) v.raiz.classList.toggle("no-prato", this.noPrato);
  }

  alternar() {
    if (!this.audio || this.ocupado) return;
    if (this.audio.tocando || this.girar) this.parar();
    else this.tocar();
  }

  async tocar() {
    const au = this.audio;
    if (!au || this.ocupado) return;
    this.ocupado = true;
    au.prepararContexto(); // ainda dentro do clique: o navegador libera o som
    // A coreografia completa só acontece com uma vitrola na tela.
    const animar = !movimentoReduzido() && this.visivel();
    if (!this.noPrato) {
      this.noPrato = true;
      this.marcarPrato();
      if (animar) await espera(820);
    }
    this.girar = true;
    this.bracoNoDisco = true;
    if (animar) {
      await espera(640);
      au.estalo(); // a agulha encosta no vinil
      await espera(420);
    }
    this.aguardarAte = performance.now() + 5000;
    au.tocar();
    this.ocupado = false;
    if (au.modo === "nenhum") {
      await espera(1600);
      this.parar();
    }
  }

  parar() {
    this.girar = false;
    this.bracoNoDisco = false;
    this.aguardarAte = 0;
    this.audio?.pausar();
  }

  // A música pode começar ou parar por outros caminhos (tecla K, "ouvir este trecho",
  // fim da faixa, silêncio final): a vitrola acompanha.
  sincronizar() {
    const au = this.audio;
    if (au.tocando) {
      this.aguardarAte = 0;
      if (!this.noPrato || !this.bracoNoDisco || !this.girar) {
        this.noPrato = true;
        this.bracoNoDisco = true;
        this.girar = true;
        this.marcarPrato();
      }
    } else if (!this.ocupado && this.bracoNoDisco && performance.now() > this.aguardarAte) {
      this.bracoNoDisco = false;
      this.girar = false;
    }
  }

  quadro = (t) => {
    const dt = this.tAnterior ? Math.min(64, t - this.tAnterior) : 16;
    this.tAnterior = t;
    const reduzido = movimentoReduzido();
    const au = this.audio;

    // O prato acelera rápido e desacelera devagar, como um motor de vitrola.
    const alvoVel = this.girar || au?.tocando ? 1 : 0;
    const k = alvoVel > this.vel ? 0.05 : 0.016;
    this.vel += (alvoVel - this.vel) * Math.min(1, k * (dt / 16));
    if (alvoVel === 0 && this.vel < 0.003) this.vel = 0;
    if (!reduzido) this.angulo = (this.angulo + this.vel * GRAUS_POR_MS * dt) % 360;

    const progresso = au?.duracao ? clamp(au.tempo / au.duracao, 0, 1) : 0;
    const alvoBraco = this.bracoNoDisco ? BRACO_BORDA + (BRACO_CENTRO - BRACO_BORDA) * progresso : BRACO_REPOUSO;
    this.braco = reduzido ? alvoBraco : this.braco + (alvoBraco - this.braco) * Math.min(1, 0.085 * (dt / 16));

    for (const v of this.vistas) {
      if (!v.raiz.closest(".slide.is-active")) continue;
      v.disco.style.transform = `rotate(${this.angulo.toFixed(2)}deg)`;
      v.braco.style.transform = `rotate(${this.braco.toFixed(2)}deg)`;
      v.raiz.classList.toggle("girando", this.vel > 0.05);
    }
    requestAnimationFrame(this.quadro);
  };
}
