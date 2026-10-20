// Áudio da apresentação.
// 1) Se assets/audio/hoje-e-dia-de-el-rey.mp3 existir: <audio> + Web Audio API
//    (o AnalyserNode alimenta a serra desenhada pela voz).
// 2) Senão: player do YouTube (precisa de internet; a serra só "respira", porque
//    o navegador não deixa analisar o som de um iframe de outro site).
// O áudio vive fora dos slides, então nunca para ao trocar de slide.

export class MotorAudio {
  constructor(config) {
    this.cfg = config.audio || {};
    this.sobreviventes = config.sobreviventes?.tempos || [];
    this.modo = "nenhum"; // "arquivo" | "youtube" | "nenhum"
    this.ouvintes = new Set();
    this.analisador = null;
    this.ultimoTempo = 0;
    this.yt = { tempo: 0, duracao: 0, estado: -1, pronto: false };
  }

  async iniciar() {
    if (this.cfg.arquivo && (await existe(this.cfg.arquivo))) {
      this.modo = "arquivo";
      this.criarElemento(this.cfg.arquivo);
    } else if (this.cfg.youtubeId && navigator.onLine !== false) {
      this.modo = "youtube";
      this.criarYoutube(this.cfg.youtubeId);
    }
    this.emitir();
  }

  /* ---------------------------------------------------- estado público */

  get tocando() {
    if (this.modo === "arquivo") return !!this.el && !this.el.paused && !this.el.ended;
    if (this.modo === "youtube") return this.yt.estado === 1;
    return false;
  }
  get tempo() {
    if (this.modo === "arquivo") return this.el?.currentTime || 0;
    return this.yt.tempo;
  }
  get duracao() {
    if (this.modo === "arquivo") return this.el?.duration || 0;
    return this.yt.duracao;
  }

  aoMudar(fn) {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }
  emitir() {
    for (const fn of this.ouvintes) fn(this);
  }

  /* ---------------------------------------------------------- comandos */

  tocar() {
    this.cancelarEsvaziar();
    if (this.modo === "arquivo") {
      this.garantirContexto();
      this.ctx?.resume?.();
      return this.el.play().catch((e) => console.warn("[áudio] não foi possível tocar:", e));
    }
    if (this.modo === "youtube") this.ytComando("playVideo");
  }

  pausar() {
    if (this.modo === "arquivo") this.el.pause();
    if (this.modo === "youtube") this.ytComando("pauseVideo");
  }

  alternar() {
    if (this.tocando) this.pausar();
    else this.tocar();
  }

  /** Vai para um ponto da música (em segundos) e toca. */
  irPara(segundos) {
    this.ultimoTempo = segundos - 0.5; // para "Filho meu" acender se o trecho começar nele
    if (this.modo === "arquivo") {
      this.el.currentTime = segundos;
      this.tocar();
    }
    if (this.modo === "youtube") {
      this.ytComando("seekTo", [segundos, true]);
      this.tocar();
    }
  }

  /** Baixa o volume até o silêncio e pausa (slide final). */
  esvaziar(segundos = 8) {
    if (!this.tocando) return;
    this.cancelarEsvaziar();
    const volume = this.cfg.volume ?? 1;
    if (this.modo === "arquivo" && this.ganho) {
      const g = this.ganho.gain;
      const agora = this.ctx.currentTime;
      g.cancelScheduledValues(agora);
      g.setValueAtTime(g.value, agora);
      g.linearRampToValueAtTime(0.0001, agora + segundos);
      this.timerEsvaziar = setTimeout(() => {
        this.el.pause();
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setValueAtTime(volume, this.ctx.currentTime);
        this.timerEsvaziar = null;
      }, segundos * 1000 + 80);
      return;
    }
    // YouTube (ou sem Web Audio): degraus de volume.
    const passos = 40;
    let i = 0;
    this.intervaloEsvaziar = setInterval(() => {
      i++;
      const v = Math.max(0, 1 - i / passos);
      if (this.modo === "youtube") this.ytComando("setVolume", [Math.round(v * 100 * volume)]);
      else if (this.el) this.el.volume = v * volume;
      if (i >= passos) {
        this.cancelarEsvaziar();
        this.pausar();
      }
    }, (segundos * 1000) / passos);
  }

  cancelarEsvaziar() {
    const volume = this.cfg.volume ?? 1;
    if (this.timerEsvaziar) {
      clearTimeout(this.timerEsvaziar);
      this.timerEsvaziar = null;
      const g = this.ganho.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setValueAtTime(volume, this.ctx.currentTime);
    }
    if (this.intervaloEsvaziar) {
      clearInterval(this.intervaloEsvaziar);
      this.intervaloEsvaziar = null;
      if (this.modo === "youtube") this.ytComando("setVolume", [Math.round(100 * volume)]);
      else if (this.el) this.el.volume = volume;
    }
  }

  /** Cria/retoma o AudioContext. Chamar dentro de um clique (regra de autoplay). */
  prepararContexto() {
    this.garantirContexto();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx && AC && !this.ctxEfeitos) this.ctxEfeitos = new AC();
    (this.ctx || this.ctxEfeitos)?.resume?.();
  }

  /** O estalo da agulha encostando no vinil: sintetizado na hora, sem arquivo. */
  estalo() {
    const ctx = this.ctx || this.ctxEfeitos;
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * 1.1);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let v = (Math.random() * 2 - 1) * 0.03 * Math.exp(-t * 2.2); // chiado que some
      if (Math.random() < 0.0012) v += (Math.random() * 2 - 1) * 0.5 * Math.exp(-t * 1.6); // estalinhos
      if (t < 0.12) v += Math.sin(2 * Math.PI * 58 * t) * 0.55 * Math.exp(-t * 32); // a batida da agulha
      d[i] = v;
    }
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.55;
    fonte.connect(g);
    // Passa pelo analisador: a serra treme de leve quando a agulha encosta.
    g.connect(this.ganho || ctx.destination);
    fonte.start();
  }

  /* ------------------------------------------------------- arquivo local */

  criarElemento(url) {
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    a.volume = 1;
    for (const ev of ["play", "pause", "ended", "loadedmetadata", "durationchange", "seeked"]) {
      a.addEventListener(ev, () => this.emitir());
    }
    a.addEventListener("timeupdate", () => {
      this.verificarSobreviventes(a.currentTime);
      this.emitir();
    });
    a.addEventListener("error", () => console.warn("[áudio] erro ao carregar", url, a.error));
    this.el = a;
  }

  // O AudioContext só pode nascer depois de um gesto do usuário (regra de autoplay).
  garantirContexto() {
    if (this.ctx || this.modo !== "arquivo") return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      const fonte = this.ctx.createMediaElementSource(this.el);
      this.ganho = this.ctx.createGain();
      this.ganho.gain.value = this.cfg.volume ?? 1;
      const an = this.ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.5;
      an.minDecibels = -92;
      an.maxDecibels = -18;
      fonte.connect(this.ganho);
      this.ganho.connect(an);
      an.connect(this.ctx.destination);
      this.analisador = an;
    } catch (e) {
      console.warn("[áudio] Web Audio indisponível; a música toca sem a serra.", e);
    }
  }

  /* ------------------------------------------------------------- YouTube */

  criarYoutube(id) {
    const caixa = document.querySelector(".pl-yt");
    if (!caixa) return;
    caixa.hidden = false;
    const origem = encodeURIComponent(location.origin);
    const iframe = document.createElement("iframe");
    iframe.title = "Hoje é Dia de El-Rey (YouTube)";
    iframe.allow = "autoplay; encrypted-media";
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?enablejsapi=1&playsinline=1&rel=0&origin=${origem}`;
    caixa.append(iframe);
    this.iframe = iframe;

    // Protocolo do player embutido (o mesmo que a IFrame API usa), sem carregar script externo.
    const escutar = () => {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    };
    iframe.addEventListener("load", () => {
      escutar();
      let tentativas = 0;
      const t = setInterval(() => {
        if (this.yt.pronto || ++tentativas > 20) return clearInterval(t);
        escutar();
      }, 500);
    });
    window.addEventListener("message", (e) => {
      let host = "";
      try {
        host = new URL(e.origin).hostname;
      } catch {
        return;
      }
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return;
      let d;
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (d?.event === "onReady" || d?.event === "initialDelivery") this.yt.pronto = true;
      const info = d?.info;
      if (info && typeof info === "object") {
        if (typeof info.currentTime === "number") {
          this.yt.tempo = info.currentTime;
          this.verificarSobreviventes(info.currentTime);
        }
        if (typeof info.duration === "number") this.yt.duracao = info.duration;
        if (typeof info.playerState === "number") this.yt.estado = info.playerState;
      }
      if (d?.event === "onStateChange" && typeof d.info === "number") this.yt.estado = d.info;
      this.emitir();
    });
  }

  ytComando(func, args = []) {
    this.iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }

  /* ------------------------------------------------- "Filho meu" acende */

  verificarSobreviventes(t) {
    const anterior = this.ultimoTempo;
    this.ultimoTempo = t;
    const natural = t >= anterior && t - anterior < 2.5;
    if (!natural) return;
    for (const alvo of this.sobreviventes) {
      if (anterior < alvo && t >= alvo) acenderFilho();
    }
  }
}

let timerFilho = null;
function acenderFilho() {
  document.body.classList.add("filho-aceso");
  clearTimeout(timerFilho);
  timerFilho = setTimeout(() => document.body.classList.remove("filho-aceso"), 4500);
}

// Confere se o mp3 existe sem baixá-lo inteiro (pede 2 bytes e aborta).
async function existe(url) {
  const ac = new AbortController();
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1" }, signal: ac.signal, cache: "no-cache" });
    const tipo = r.headers.get("content-type") || "";
    ac.abort();
    return r.ok && !tipo.includes("text/html");
  } catch {
    return false;
  }
}
