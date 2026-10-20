// Janela do modo apresentador (tecla N na apresentação).
// Mostra o slide atual e o próximo (prévias reais em iframe), as notas de fala,
// um cronômetro e o controle da música. Tudo sincronizado por BroadcastChannel.

import { $, md, fmtTempo } from "./util.js";
import { abrirCanal } from "./sync.js";

let roteiro = [];
let estado = { index: 0, passo: 0 };
let conectado = false;

const canal = abrirCanal(receber);

function receber(m) {
  if (!m) return;
  if (m.tipo === "roteiro") {
    roteiro = m.slides || [];
    conectado = true;
    $("#conexao").textContent = `conectado · ${roteiro.length} slides`;
    $("#conexao").classList.add("ok");
    desenhar();
  } else if (m.tipo === "estado") {
    if (!conectado) canal.enviar({ tipo: "ola" });
    const mudouSlide = m.index !== estado.index;
    estado = { index: m.index, passo: m.passo };
    if (mudouSlide && m.index > 0 && !crono.rodando && crono.acumulado === 0) iniciarCrono();
    desenhar();
  } else if (m.tipo === "audio") {
    $("#au-btn").textContent = m.tocando ? "pausar" : "tocar";
    $("#au-btn").disabled = m.modo === "nenhum";
    $("#au-tempo").textContent = m.modo === "nenhum" ? "sem áudio" : `${fmtTempo(m.tempo)} / ${m.duracao ? fmtTempo(m.duracao) : "–:––"}`;
    $("#au-modo").textContent = m.modo === "youtube" ? "via YouTube · serra simulada" : m.modo === "arquivo" ? "mp3 local" : "";
  }
}

// Procura a apresentação até ela responder (ela pode ter sido aberta depois).
canal.enviar({ tipo: "ola" });
const procura = setInterval(() => {
  if (conectado) return clearInterval(procura);
  canal.enviar({ tipo: "ola" });
}, 1000);

/* ----------------------------------------------------------------- tela */

function desenhar() {
  if (!roteiro.length) return;
  const atual = roteiro[estado.index];
  const prox = roteiro[estado.index + 1];

  $("#atual-titulo").textContent = `${String(estado.index + 1).padStart(2, "0")} · ${atual.titulo}`;
  $("#atual-passo").textContent = atual.passos ? `passo ${estado.passo} de ${atual.passos}` : "";
  $("#atual-quem").innerHTML = atual.apresentador ? `apresenta: <b>${md(atual.apresentador)}</b>` : "";

  if (prox) {
    $("#prox-titulo").textContent = `${String(estado.index + 2).padStart(2, "0")} · ${prox.titulo}`;
    const troca = prox.apresentador && prox.apresentador !== atual.apresentador;
    $("#prox-quem").innerHTML = prox.apresentador ? `apresenta: <b>${md(prox.apresentador)}</b>${troca ? ' <span class="troca">· troca de apresentador</span>' : ""}` : "";
  } else {
    $("#prox-titulo").textContent = "fim";
    $("#prox-quem").textContent = "";
  }

  const notas = (atual.notas || "").split(/\n+/).filter(Boolean);
  $("#notas").innerHTML = notas.length ? notas.map((p) => `<p>${md(p)}</p>`).join("") : "<p>(sem notas para este slide)</p>";

  previa($("#prev-atual"), atual.id, estado.passo);
  if (prox) previa($("#prev-prox"), prox.id, 0);
}

// Guarda o último slide pedido; se o quadro ainda estiver carregando, ele é aplicado no "load".
function previa(iframe, id, passo) {
  iframe.dataset.alvo = `#/${encodeURIComponent(id)}/${passo}`;
  if (!iframe.dataset.carregado) {
    iframe.dataset.carregado = "1";
    iframe.addEventListener("load", () => aplicarAlvo(iframe));
    iframe.src = `./?previa=1${iframe.dataset.alvo}`;
    return;
  }
  aplicarAlvo(iframe);
}

function aplicarAlvo(iframe) {
  try {
    const w = iframe.contentWindow;
    if (w.location.hash !== iframe.dataset.alvo) w.location.hash = iframe.dataset.alvo;
  } catch {
    iframe.src = `./?previa=1${iframe.dataset.alvo}`;
  }
}

// Escala as prévias (1600x900) para o tamanho do quadro.
function escalar() {
  for (const tela of document.querySelectorAll(".tela")) {
    const f = tela.querySelector("iframe");
    f.style.transform = `scale(${tela.clientWidth / 1600})`;
  }
}
new ResizeObserver(escalar).observe(document.body);
escalar();

/* ----------------------------------------------------------- cronômetro */

const crono = { rodando: false, inicio: 0, acumulado: 0 };

function iniciarCrono() {
  crono.rodando = true;
  crono.inicio = performance.now();
  $("#crono-btn").textContent = "pausar";
}
function pausarCrono() {
  crono.acumulado += performance.now() - crono.inicio;
  crono.rodando = false;
  $("#crono-btn").textContent = "continuar";
}
$("#crono-btn").addEventListener("click", () => (crono.rodando ? pausarCrono() : iniciarCrono()));
$("#crono-zerar").addEventListener("click", () => {
  crono.rodando = false;
  crono.acumulado = 0;
  $("#crono-btn").textContent = "iniciar";
});

setInterval(() => {
  const ms = crono.acumulado + (crono.rodando ? performance.now() - crono.inicio : 0);
  const s = Math.floor(ms / 1000);
  $("#crono").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const d = new Date();
  $("#relogio").textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}, 250);

/* ------------------------------------------------------------- comandos */

const nav = (acao) => canal.enviar({ tipo: "nav", acao });
$("#nav-prox").addEventListener("click", () => nav("proximo"));
$("#nav-ant").addEventListener("click", () => nav("anterior"));
$("#nav-black").addEventListener("click", () => canal.enviar({ tipo: "blackout" }));
$("#au-btn").addEventListener("click", () => canal.enviar({ tipo: "audio", acao: "alternar" }));

addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  let feito = true;
  if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) nav("proximo");
  else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) nav("anterior");
  else if (k === "k" || k === "K") canal.enviar({ tipo: "audio", acao: "alternar" });
  else if (k === "b" || k === "B" || k === ".") canal.enviar({ tipo: "blackout" });
  else feito = false;
  if (feito) {
    e.preventDefault();
    document.activeElement?.blur?.();
  }
});
