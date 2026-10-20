// Ponto de entrada: carrega o conteúdo, monta os slides, liga áudio, voz e navegação.
// index.html?previa  → modo prévia (usado pelos quadros do modo apresentador).

import { $, el, fmtTempo } from "./util.js";
import { carregarConteudo } from "./content.js";
import { renderizar } from "./render.js";
import { Deck } from "./deck.js";
import { MotorAudio } from "./audio.js";
import { Voz } from "./voz.js";
import { Vitrolas } from "./vitrola.js";
import { abrirCanal } from "./sync.js";

const previa = new URLSearchParams(location.search).has("previa");

async function iniciar() {
  if (previa) document.body.classList.add("previa");

  let conteudo;
  try {
    conteudo = await carregarConteudo();
  } catch (e) {
    mostrarErro(e);
    return;
  }

  const audio = previa ? null : new MotorAudio(conteudo.config);
  // A vitrola é o controle da música: clique no disco, tecla K, mini-player e modo
  // apresentador passam todos por ela, para o disco e o braço sempre acompanharem o som.
  const vitrolas = new Vitrolas(audio);
  const alternarMusica = () => vitrolas.alternar();
  // ctx.acoes é preenchido depois que a navegação existe (os slides usam para pular passos).
  const ctx = { ...conteudo, palavras: conteudo.config.sobreviventes?.palavras || [], audio, vitrolas, acoes: {} };

  const deckEl = $("#deck");
  const renders = conteudo.slides.map((s) => {
    try {
      const r = renderizar(s, ctx);
      deckEl.append(r.el);
      return r;
    } catch (e) {
      console.error(`[slide ${s.id}]`, e);
      const falha = el("section", { class: "slide", "data-tema": "papel" }, el("div", { class: "stage" }, el("p", { class: "aviso-tipo", text: `Erro ao montar o slide "${s.id}": ${e.message}` })));
      deckEl.append(falha);
      return { el: falha, passos: 0 };
    }
  });

  const voz = new Voz($("#voz"), audio, conteudo.config.voz, { estatico: previa });

  // Canal com o modo apresentador (não abre nas prévias, para não responder em dobro).
  let deck;
  const canal = previa
    ? null
    : abrirCanal((m) => {
        if (!deck || !m) return;
        if (m.tipo === "ola") {
          canal.enviar({ tipo: "roteiro", slides: deck.roteiro() });
          deck.publicar();
          enviarAudio();
        } else if (m.tipo === "nav") {
          if (m.acao === "proximo") deck.proximo();
          else if (m.acao === "anterior") deck.anterior();
          else if (m.acao === "ir") deck.irPara(m.index, m.passo || 0);
        } else if (m.tipo === "audio" && m.acao === "alternar") {
          alternarMusica();
        } else if (m.tipo === "blackout") {
          deck.alternarBlackout();
        }
      });

  let ultimoEnvio = 0;
  const enviarAudio = () => {
    if (!audio || !canal) return;
    canal.enviar({ tipo: "audio", tocando: audio.tocando, tempo: audio.tempo, duracao: audio.duracao, modo: audio.modo });
  };

  deck = new Deck({ slides: conteudo.slides, renders, voz, audio, canal, previa, alternarMusica });
  Object.assign(ctx.acoes, {
    proximo: () => deck.proximo(),
    irPasso: (n) => deck.irPara(deck.estado.index, n),
    alternarPasso: (n) => deck.irPara(deck.estado.index, deck.estado.passo === n ? n - 1 : n),
    tocarMusica: () => {
      if (audio && !audio.tocando) vitrolas.tocar();
    },
  });

  if (audio) {
    ligarPlayer(audio, alternarMusica);
    audio.aoMudar(() => {
      const agora = performance.now();
      if (agora - ultimoEnvio > 450) {
        ultimoEnvio = agora;
        enviarAudio();
      }
    });
    // Botões dentro dos slides: "ouvir" e "ouvir este trecho".
    // Elementos com data-acao dentro dos slides: a vitrola e os "ouvir este trecho".
    deckEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      if (b.dataset.acao === "vitrola") vitrolas.alternar();
      if (b.dataset.acao === "trecho") {
        audio.prepararContexto();
        audio.irPara(Number(b.dataset.inicio) || 0);
      }
      b.blur();
    });
    audio.iniciar();
  }

  deck.iniciar();
  voz.iniciar();
  document.body.classList.remove("carregando");
  if (!previa) {
    setTimeout(() => $(".dica")?.classList.add("some"), 9000);
    registrarSW();
  }
}

function ligarPlayer(audio, alternarMusica) {
  const player = $(".player");
  const btn = $(".pl-btn");
  const tempo = $(".pl-tempo");
  const modo = $(".pl-modo");
  btn.addEventListener("click", () => {
    alternarMusica();
    btn.blur();
  });
  const atualizar = () => {
    const tocando = audio.tocando;
    document.body.classList.toggle("audio-tocando", tocando);
    btn.classList.toggle("tocando", tocando);
    btn.setAttribute("aria-label", tocando ? "Pausar a música (K)" : "Tocar a música (K)");
    btn.disabled = audio.modo === "nenhum";
    const dur = audio.duracao;
    tempo.textContent = audio.modo === "nenhum" ? "sem áudio" : `${fmtTempo(audio.tempo)} / ${dur ? fmtTempo(dur) : "–:––"}`;
    modo.textContent = audio.modo === "youtube" ? "YouTube" : "";
    player.hidden = false;
  };
  audio.aoMudar(atualizar);
  atualizar();
}

function mostrarErro(e) {
  console.error(e);
  const caixa = $("#erro");
  caixa.replaceChildren(
    el("h1", { text: "O conteúdo precisa de um ajuste" }),
    e.arquivo && el("p", {}, "Arquivo: ", el("strong", { text: e.arquivo })),
    el("pre", { text: e.message || String(e) }),
    el("p", { text: "Corrija o arquivo, salve e recarregue a página (F5)." }),
  );
  caixa.classList.add("visivel");
  document.body.classList.remove("carregando");
}

// Service worker: guarda uma cópia para funcionar sem internet depois da primeira visita.
// Sempre tenta a rede primeiro, então edições no conteúdo aparecem na hora.
// ?semcache na URL desliga e limpa tudo.
function registrarSW() {
  if (!("serviceWorker" in navigator)) return;
  if (new URLSearchParams(location.search).has("semcache")) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    window.caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
    return;
  }
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

iniciar();
