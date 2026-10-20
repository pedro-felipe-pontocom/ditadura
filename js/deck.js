// Navegação da apresentação: um slide por vez, passos dentro do slide,
// teclado (setas, espaço, PageUp/PageDown de passador), clique, swipe,
// endereço (#/id/passo) e a transição da tarja.

import { $, clamp, movimentoReduzido } from "./util.js";
import { rotuloSlide } from "./render.js";

const INTERATIVOS = "button, a, input, textarea, select, iframe, label, [data-acao], [data-nao-navegar], .player, .pl-yt";

export class Deck {
  constructor({ slides, renders, voz, audio, canal, previa, alternarMusica }) {
    this.slides = slides;
    this.renders = renders;
    this.voz = voz;
    this.audio = audio;
    this.alternarMusica = alternarMusica || (() => audio?.alternar());
    this.canal = canal;
    this.previa = previa;
    this.visivel = -1; // slide na tela
    this.estado = { index: 0, passo: 0 }; // slide pedido (pode estar em transição)
    this.emTransicao = false;
    this.wipe = $("#wipe");
  }

  get total() {
    return this.slides.length;
  }
  passosDe(i) {
    return this.renders[i]?.passos || 0;
  }

  iniciar() {
    const [i, p] = this.lerEndereco();
    this.irPara(i, p, { instantaneo: true });
    addEventListener("hashchange", () => {
      const [ni, np] = this.lerEndereco();
      if (ni !== this.estado.index || np !== this.estado.passo) this.irPara(ni, np, { instantaneo: this.previa });
    });
    if (!this.previa) this.ligarEntradas();
  }

  /* ------------------------------------------------------------ navegação */

  proximo() {
    const { index, passo } = this.estado;
    if (passo < this.passosDe(index)) this.irPara(index, passo + 1);
    else if (index < this.total - 1) this.irPara(index + 1, 0);
  }

  anterior() {
    const { index, passo } = this.estado;
    if (passo > 0) this.irPara(index, passo - 1);
    else if (index > 0) this.irPara(index - 1, this.passosDe(index - 1));
  }

  irPara(index, passo = 0, { instantaneo = false } = {}) {
    index = clamp(index | 0, 0, this.total - 1);
    passo = clamp(passo | 0, 0, this.passosDe(index));
    this.estado = { index, passo };
    if (this.emTransicao) return; // a troca em andamento lê this.estado no meio da varredura

    if (index === this.visivel) {
      this.aplicarPasso(passo);
      this.publicar();
      return;
    }
    if (instantaneo || this.previa || movimentoReduzido() || this.visivel < 0 || !this.wipe?.animate) {
      this.mostrar(index, passo);
      return;
    }

    // Transição: a tarja cobre a tela, o slide troca por baixo, a tarja sai pelo outro lado.
    const dir = index > this.visivel ? 1 : -1;
    this.emTransicao = true;
    this.wipe.style.transformOrigin = dir > 0 ? "left center" : "right center";
    const cobrir = this.wipe.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: 230,
      easing: "cubic-bezier(.7,0,.84,0)",
      fill: "forwards",
    });
    cobrir.finished
      .then(() => {
        this.mostrar(this.estado.index, this.estado.passo);
        this.wipe.style.transformOrigin = dir > 0 ? "right center" : "left center";
        return this.wipe.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
          duration: 340,
          easing: "cubic-bezier(.16,1,.3,1)",
          fill: "forwards",
        }).finished;
      })
      .catch(() => this.mostrar(this.estado.index, this.estado.passo))
      .finally(() => {
        this.emTransicao = false;
        // Se pediram outro slide durante a transição, vai direto.
        const { index: i, passo: p } = this.estado;
        if (i !== this.visivel) this.mostrar(i, p);
        else if (p !== this.passoVisivel) this.aplicarPasso(p);
      });
  }

  mostrar(index, passo) {
    const antigo = this.renders[this.visivel];
    if (antigo) {
      antigo.el.classList.remove("is-active");
      antigo.aoSair?.();
    }
    const novo = this.renders[index];
    const slide = this.slides[index];
    novo.el.classList.add("is-active");
    this.visivel = index;
    document.body.dataset.tema = slide.tema || "papel";
    document.body.dataset.slide = slide.id;
    this.voz?.definirModo(novo.el.dataset.voz, slide.tema || "papel");
    this.aplicarPasso(passo, true);
    novo.aoEntrar?.();
    this.atualizarChrome();
    this.publicar();
  }

  aplicarPasso(passo, entrando = false) {
    const r = this.renders[this.visivel];
    if (!r) return;
    this.passoVisivel = passo;
    r.el.dataset.passo = passo;
    r.el.classList.toggle("entrando", entrando);
    r.el.querySelectorAll("[data-passo]").forEach((n) => n.classList.toggle("on", Number(n.dataset.passo) <= passo));
    r.aoPasso?.(passo, { entrando });
    if (entrando) requestAnimationFrame(() => requestAnimationFrame(() => r.el.classList.remove("entrando")));
  }

  /* ----------------------------------------------- endereço e elementos fixos */

  lerEndereco() {
    const m = /^#\/([^/]+)(?:\/(\d+))?/.exec(location.hash);
    if (!m) return [0, 0];
    const i = this.slides.findIndex((s) => s.id === decodeURIComponent(m[1]));
    return i < 0 ? [0, 0] : [i, Number(m[2] || 0)];
  }

  publicar() {
    const { index, passo } = this.estado;
    const hash = `#/${encodeURIComponent(this.slides[index].id)}/${passo}`;
    if (!this.previa && location.hash !== hash) history.replaceState(null, "", hash);
    this.canal?.enviar({ tipo: "estado", index, passo, total: this.total });
    if (this.visivel > 0 || passo > 0) document.querySelector(".dica")?.classList.add("some");
  }

  atualizarChrome() {
    if (this.previa) return;
    const i = this.visivel;
    const s = this.slides[i];
    const cont = $(".contador");
    if (cont) cont.innerHTML = `${String(i + 1).padStart(2, "0")} <span class="de">/ ${String(this.total).padStart(2, "0")}</span>`;
    const barra = $(".progresso span");
    if (barra) barra.style.transform = `scaleX(${this.total > 1 ? i / (this.total - 1) : 1})`;
    const ap = $(".apresentador");
    if (ap) {
      ap.hidden = !s.apresentador;
      $(".ap-nome", ap).textContent = s.apresentador || "";
    }
    document.title = `${rotuloSlide(s)} · Hoje é Dia de El-Rey`;
  }

  roteiro() {
    return this.slides.map((s, i) => ({
      id: s.id,
      titulo: rotuloSlide(s),
      apresentador: s.apresentador,
      notas: s.notas || "",
      passos: this.passosDe(i),
      tema: s.tema || "papel",
    }));
  }

  /* -------------------------------------------------------------- entradas */

  ligarEntradas() {
    addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest?.("input, textarea, select")) return;
      const k = e.key;
      let feito = true;
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === "Enter" || (k === " " && !e.shiftKey)) this.proximo();
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace" || (k === " " && e.shiftKey)) this.anterior();
      else if (k === "Home") this.irPara(0, 0);
      else if (k === "End") this.irPara(this.total - 1, 0);
      else if (k === "f" || k === "F") this.telaCheia();
      else if (k === "n" || k === "N") this.abrirApresentador();
      else if (k === "k" || k === "K" || k === "p" || k === "P") this.alternarMusica();
      else if (k === "b" || k === "B" || k === ".") this.alternarBlackout();
      else if (k === "Escape" && document.body.classList.contains("blackout")) this.alternarBlackout();
      else feito = false;
      if (feito) e.preventDefault();
    });

    // Clique (mouse) avança; clique na borda esquerda volta. Toque: swipe.
    let toque = null;
    addEventListener(
      "pointerdown",
      (e) => {
        toque = { x: e.clientX, y: e.clientY, tipo: e.pointerType, alvo: e.target, botao: e.button };
      },
      { passive: true },
    );
    addEventListener("pointerup", (e) => {
      const t = toque;
      toque = null;
      if (!t || t.alvo.closest?.(INTERATIVOS)) return;
      if (document.body.classList.contains("blackout")) return this.alternarBlackout();
      const dx = e.clientX - t.x;
      const dy = e.clientY - t.y;
      if (t.tipo === "touch" || t.tipo === "pen") {
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? this.proximo() : this.anterior());
        return;
      }
      if (t.botao !== 0 || Math.hypot(dx, dy) > 8) return; // arrastou: provavelmente selecionando texto
      if (e.clientX < innerWidth * 0.16) this.anterior();
      else this.proximo();
    });
    addEventListener("pointercancel", () => (toque = null));
  }

  telaCheia() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  alternarBlackout() {
    document.body.classList.toggle("blackout");
  }

  abrirApresentador() {
    const w = open("presenter.html", "el-rey-apresentador", "popup,width=1280,height=800");
    if (!w) alert("O navegador bloqueou a janela do apresentador. Permita pop-ups para este site e aperte N de novo.");
  }
}
