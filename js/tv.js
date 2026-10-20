// A TV da propaganda (slide de fechamento).
// "Telas falam colorido" (Fernando Brant): é o único objeto colorido da apresentação.
// Os slogans do "milagre econômico" passam sozinhos; clicar na TV muda de canal (com chiado).
// Quando entra o outro milagre, a TV desliga: a imagem se fecha numa linha e some.

import { el, movimentoReduzido } from "./util.js";

export function criarTV(slogans, legenda) {
  const texto = el("p", { class: "tv-slogan" });
  const chiado = el("canvas", { class: "tv-chiado", width: 120, height: 90 });
  const raiz = el(
    "figure",
    { class: "tv", "data-nao-navegar": true, title: "Clique para mudar de canal" },
    el("div", { class: "tv-antena", "aria-hidden": "true" }),
    el(
      "div",
      { class: "tv-corpo" },
      el("div", { class: "tv-tela" }, el("div", { class: "tv-imagem" }, texto), chiado, el("div", { class: "tv-linhas", "aria-hidden": "true" })),
      el("div", { class: "tv-painel", "aria-hidden": "true" }, el("span", { class: "tv-dial" }), el("span", { class: "tv-dial pequeno" }), el("span", { class: "tv-grade" })),
    ),
    el("figcaption", { html: legenda || "" }),
  );

  const g = chiado.getContext("2d");
  let canal = 0;
  let timer = null;
  let ligada = true;
  let ativa = false;

  const mostrar = (n) => {
    canal = (n + slogans.length) % slogans.length;
    texto.textContent = slogans[canal];
    texto.dataset.cor = String(canal % 2);
  };

  const pintarChiado = () => {
    const img = g.createImageData(120, 90);
    for (let k = 0; k < img.data.length; k += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };

  const trocar = () => {
    if (!ligada) return;
    if (movimentoReduzido()) return mostrar(canal + 1);
    raiz.classList.add("chiando");
    let quadros = 0;
    const passo = () => {
      pintarChiado();
      if (++quadros < 10) requestAnimationFrame(passo);
      else {
        mostrar(canal + 1);
        raiz.classList.remove("chiando");
      }
    };
    passo();
  };

  const agendar = () => {
    clearInterval(timer);
    timer = ativa && ligada ? setInterval(trocar, 3800) : null;
  };

  raiz.addEventListener("click", () => {
    trocar();
    agendar();
  });
  mostrar(0);

  return {
    el: raiz,
    iniciar() {
      ativa = true;
      agendar();
    },
    parar() {
      ativa = false;
      agendar();
    },
    ligar() {
      ligada = true;
      raiz.classList.remove("desligada");
      agendar();
    },
    desligar() {
      ligada = false;
      raiz.classList.add("desligada");
      agendar();
    },
  };
}
