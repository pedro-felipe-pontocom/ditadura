// Monta o DOM de cada tipo de slide a partir do conteúdo (content/*.json).
// Cada renderizador pode devolver { passos, aoPasso(n), aoEntrar(), aoSair() }.
// Elementos com data-passo="k" ganham a classe .on quando o passo atual >= k.

import { el, md, fmtTempo, hashString, mulberry32 } from "./util.js";
import { criarVerso, liberar, tarjar, barra } from "./tarja.js";
import { criarTV } from "./tv.js";

// Modo da voz (serra grande ou linha fina no rodapé) por tipo de slide.
const MODO_VOZ = { abertura: "serra", silencio: "serra" };

export function rotuloSlide(s) {
  if (s.tipo === "analise") return `Análise · ${s.parte}`;
  if (s.tipo === "abertura") return "Abertura";
  if (s.tipo === "tese") return "A tese";
  if (s.tipo === "silencio") return "Silêncio";
  const t = s.titulo || s.kicker || s.sigla || s.id;
  return String(Array.isArray(t) ? t.join(" ") : t).replace(/\*/g, "");
}

export function renderizar(slide, ctx) {
  const section = el("section", {
    class: `slide s-${slide.tipo}`,
    id: `slide-${slide.id}`,
    "data-tema": slide.tema || "papel",
    "data-voz": MODO_VOZ[slide.tipo] || "linha",
    "aria-label": rotuloSlide(slide),
  });
  const stage = el("div", { class: "stage" });
  section.append(stage);
  const fn = RENDER[slide.tipo];
  let api = {};
  if (fn) api = fn(slide, stage, ctx) || {};
  else stage.append(el("p", { class: "aviso-tipo", text: `Tipo de slide desconhecido: ${slide.tipo}` }));
  if (slide.fontes?.length) stage.append(linhaFontes(slide.fontes, ctx.fontes));
  return {
    el: section,
    passos: api.passos || 0,
    aoPasso: api.aoPasso,
    aoEntrar: api.aoEntrar,
    aoSair: api.aoSair,
  };
}

/* ------------------------------------------------------------------ peças */

const kicker = (texto) => texto && el("p", { class: "kicker", html: md(texto) });

function linhaFontes(chaves, fontes) {
  const nomes = chaves.map((k) => {
    if (!fontes[k]) console.warn(`[conteúdo] fonte desconhecida: ${k}`);
    return fontes[k]?.curta || k;
  });
  return el("p", { class: "fontes" }, el("b", { text: "Fontes" }), nomes.join(" · "));
}

function citacao(c, classe = "") {
  if (!c) return null;
  return el(
    "blockquote",
    { class: `cit ${classe}` },
    el("p", { html: `“${md(c.texto)}”` }),
    el("footer", { class: "cit-ref" }, c.autor && el("span", { class: "autor", text: c.autor }), c.ref),
  );
}

/** Bloco com a letra tarjada. opts: { estrofes: [1,2], comVozes, classe } */
function blocoLetra(ctx, opts = {}) {
  const { letra } = ctx;
  const box = el("div", { class: `letra ${opts.classe || ""}` });
  const versos = [];
  const cor = opts.cor || "#11100e";
  letra.estrofes.forEach((e, ei) => {
    if (opts.estrofes && !opts.estrofes.includes(ei + 1)) return;
    const est = el("div", { class: "estrofe" });
    if (opts.comVozes && e.voz) est.append(el("span", { class: "voz-rotulo", text: e.voz }));
    e.versos.forEach((v, vi) => {
      const verso = criarVerso(v, {
        palavras: ctx.palavras,
        chave: `${ei}.${vi}.${v}`,
        cor,
        placeholder: letra.placeholder,
      });
      est.append(verso);
      versos.push(verso);
    });
    box.append(est);
  });
  return { box, versos };
}

/* ------------------------------------------------------------- abertura */

function abertura(s, st, ctx) {
  const { box } = blocoLetra(ctx, { classe: "letra-mini" });
  // No lugar de um botão de play: a vitrola. O disco sai da capa e vai para o prato.
  const play = el(
    "div",
    { class: "ab-vitrola" },
    ctx.vitrolas.criar(s.capa),
    el(
      "p",
      { class: "ab-vitrola-legenda" },
      el("span", { class: "parado", html: md(s.chamada) }),
      el("span", { class: "tocando", html: md(s.chamadaTocando) }),
    ),
  );
  st.append(
    el("p", { class: "ab-rotulo", text: s.rotulo }),
    el(
      "div",
      { class: "ab-titulo" },
      el("h1", { html: md(s.titulo) }),
      el("p", { class: "ab-autores", text: s.autores }),
      el("p", { class: "ab-disco", text: s.disco }),
    ),
    play,
    el(
      "figure",
      { class: "ab-letra" },
      box,
      el("figcaption", { html: md(s.legenda) }),
      ctx.letra.placeholder && el("p", { class: "aviso-letra", text: "Letra ainda não inserida: edite content/letra.md" }),
    ),
  );
}

/* ----------------------------------------------------------------- tese */

function tese(s, st) {
  st.append(
    el("div", { class: "te-linhas" }, s.linhas.map((l) => el("p", { class: "te-linha", html: md(l) }))),
    // Clicar em "Filho meu." leva a música ao segundo em que as palavras são cantadas.
    el("button", { type: "button", class: "te-destaque", "data-acao": "trecho", "data-inicio": s.destaqueInicio ?? 55, "data-sobrevivente": true, html: md(s.destaque) }),
    s.destaqueDica && el("p", { class: "te-dica", html: md(s.destaqueDica) }),
    citacao(s.citacao, "te-cit"),
  );
}

/* ------------------------------------------------------------- contexto */

function contexto(s, st) {
  st.append(
    kicker(s.kicker),
    el(
      "div",
      { class: "ctx-cabeca" },
      el("div", { class: "ctx-sigla", text: s.sigla }),
      el("p", { class: "ctx-data", text: s.data }),
      el("p", { class: "ctx-lead", html: md(s.lead) }),
    ),
    el(
      "div",
      { class: "ctx-blocos" },
      s.blocos.map((b, i) =>
        el("div", { class: "ctx-bloco" }, el("h3", {}, el("span", { class: "n", text: String(i + 1).padStart(2, "0") }), b.titulo), el("p", { html: md(b.texto) })),
      ),
    ),
    citacao(s.citacao, "ctx-cit"),
  );
}

/* ------------------------------------------------------- linha do tempo */

function linhaDoTempo(s, st, ctx) {
  const span = s.fim - s.inicio;
  const pos = (ano) => `${((ano - s.inicio) / span) * 100}%`;

  const anoGrande = el("div", { class: "tl-ano" });
  const titulo = el("h2", { class: "tl-titulo" });
  const texto = el("p", { class: "tl-texto" });
  const legenda = el("div", { class: "tl-legenda", "aria-live": "polite" }, anoGrande, el("div", { class: "tl-desc" }, titulo, texto));

  const eixo = el("div", { class: "tl-eixo" });
  for (let a = s.inicio; a <= s.fim; a++) {
    eixo.append(el("span", { class: `tl-tick${a % 5 === 0 ? " maior" : ""}`, style: { left: pos(a) } }));
  }
  for (const f of s.faixas || []) {
    eixo.append(
      el(
        "div",
        { class: "tl-faixa", style: { left: pos(f.de), width: `${((f.ate - f.de) / span) * 100}%` } },
        el("span", { html: `${f.de}–${f.ate} · ${md(f.rotulo)}` }),
      ),
    );
  }
  const marcos = s.marcos.map((m, i) => {
    const mk = el(
      "div",
      {
        class: `tl-marco${m.destaque ? " destaque" : ""}${i % 2 ? " baixo" : ""}`,
        style: { left: pos(m.ano) },
        "data-nao-navegar": true,
        title: `Ir para ${m.rotulo || Math.floor(m.ano)}`,
      },
      el("span", { class: "tl-ponto" }),
      el("span", { class: "tl-rotulo", text: m.rotulo || String(Math.floor(m.ano)) }),
    );
    // Clicar num ano vai direto para ele.
    mk.addEventListener("click", () => ctx.acoes?.irPasso(i + 1));
    eixo.append(mk);
    return mk;
  });

  st.append(kicker(s.kicker), legenda, eixo);

  const mostrar = (n) => {
    const m = n > 0 ? s.marcos[n - 1] : null;
    anoGrande.textContent = m ? m.rotulo || String(Math.floor(m.ano)) : `${s.inicio}–${s.fim}`;
    titulo.innerHTML = md(m ? m.titulo : s.resumo);
    texto.innerHTML = m ? md(m.texto) : "";
    legenda.classList.toggle("destaque", !!m?.destaque);
    legenda.classList.toggle("geral", !m);
    marcos.forEach((mk, i) => {
      mk.classList.toggle("atual", i === n - 1);
      mk.classList.toggle("visto", i < n - 1);
    });
    legenda.classList.remove("troca");
    void legenda.offsetWidth; // reinicia a animação
    legenda.classList.add("troca");
  };
  return { passos: s.marcos.length, aoPasso: mostrar };
}

/* ------------------------------------------------------------ biografia */

function bio(s, st) {
  st.append(
    kicker(s.kicker),
    el("h2", { class: "bio-nome" }, s.nome.map((n) => el("span", { text: n }))),
    s.subtitulo && el("p", { class: "bio-sub", html: md(s.subtitulo) }),
    el(
      "ol",
      { class: "bio-eventos" },
      s.eventos.map((e) => el("li", {}, el("span", { class: "bio-ano", text: e.ano }), el("p", { html: md(e.texto) }))),
    ),
  );
}

/* ------------------------------------------------------------ parceiros */

function parceiros(s, st) {
  const pessoa = (p, classe, i) => {
    const r = mulberry32(hashString(p.nome));
    const barras = el(
      "div",
      { class: "pa-barras", "aria-hidden": "true" },
      [0, 1, 2].map((k) => barra(`${p.nome}${k}`, 55 + r() * 45, "#ebe4d6")),
    );
    return el(
      "article",
      { class: `pa-pessoa ${classe}` },
      el("p", { class: "pa-papel", html: md(p.papel) }),
      el("h3", { text: p.nome }),
      el("p", { class: "pa-datas", html: md(p.datas) }),
      barras,
      el("p", { class: "pa-texto", html: md(p.texto) }),
      p.citacao && el("blockquote", { class: "pa-cit", html: `“${md(p.citacao)}”` }),
    );
  };
  const [principal, ...outros] = s.pessoas;
  st.append(
    kicker(s.kicker),
    el("h2", { class: "pa-titulo", html: md(s.titulo) }),
    pessoa(principal, "pa-principal"),
    el("div", { class: "pa-outros" }, outros.map((p) => pessoa(p, "pa-outro"))),
    el(
      "ul",
      { class: "pa-vozes" },
      s.vozes.map((v) => el("li", {}, el("span", { class: "pa-voz-nome", text: v.nome }), el("span", { html: md(v.texto) }))),
    ),
  );
}

/* ---------------------------------------------------------------- disco */

function disco(s, st, ctx) {
  const e = s.encarte;
  // Verso do encarte: as 11 faixas e o que a censura fez com cada uma.
  const lados = [];
  for (const f of e.faixas || []) {
    let lado = lados.find((l) => l.nome === f.lado);
    if (!lado) lados.push((lado = { nome: f.lado, faixas: [] }));
    lado.faixas.push(f);
  }
  const verso = el(
    "div",
    { class: "enc-verso" },
    el("p", { class: "enc-verso-titulo", text: e.versoTitulo || "As faixas" }),
    lados.map((l) =>
      el(
        "div",
        { class: "enc-lado" },
        el("h4", { text: l.nome }),
        l.faixas.map((f) =>
          el("p", { class: "enc-faixa" }, el("span", { text: f.titulo }), el("span", { class: `enc-status ${f.tipo || ""}`, text: f.status })),
        ),
      ),
    ),
  );
  const encarte = el(
    "figure",
    { class: "encarte", "data-passo": 1, "data-nao-navegar": true, title: "Clique para virar o encarte" },
    el(
      "div",
      { class: "enc-carta" },
      el(
        "div",
        { class: "enc-folha" },
        el("p", { class: "enc-titulo", text: e.titulo }),
        e.creditos.map((c) => el("p", { class: "enc-credito", text: c })),
        el("div", { class: "enc-vazio", "aria-label": "espaço da letra, em branco" }),
      ),
      verso,
    ),
    el("figcaption", { html: md(e.legenda) }),
  );
  encarte.addEventListener("click", () => ctx.acoes?.alternarPasso(1));
  st.append(
    kicker(s.kicker),
    el("h2", { class: "di-titulo", html: md(s.titulo) }),
    el("p", { class: "di-ficha", text: s.ficha }),
    el(
      "ol",
      { class: "di-numeros" },
      s.numeros.map((n) => el("li", { class: n.destaque ? "destaque" : "" }, el("span", { class: "di-valor", text: n.valor }), el("span", { class: "di-rot", html: md(n.texto) }))),
    ),
    el("p", { class: "di-texto", html: md(s.texto) }),
    encarte,
    el("div", { class: "di-cits" }, s.citacoes.map((c, i) => citacao(c, i === 0 ? "di-cit-1" : "di-cit-2"))),
  );
  return { passos: e.faixas?.length ? 1 : 0 };
}

/* ------------------------------------------------- "agora vocês são a censura" */

function censor(s, st, ctx) {
  const linhas = s.cartas.map((c, i) => {
    const botoes = ["liberar", "vetar"].map((v) =>
      el("button", { type: "button", class: `cs-voto cs-${v}`, "data-voto": v }, v === "liberar" ? "Liberar" : "Vetar"),
    );
    const linha = el(
      "div",
      { class: "cs-linha" },
      el("span", { class: "cs-num", text: String(i + 1).padStart(2, "0") }),
      el("div", { class: "cs-musica" }, el("h3", { html: md(c.musica) }), el("p", { text: c.autores })),
      el("blockquote", { class: "cs-trecho", html: md(c.trecho).split(" / ").join("<br>") }),
      el("div", { class: "cs-turma" }, botoes),
      el(
        "div",
        { class: "cs-veredito" },
        el("span", { class: `cs-carimbo ${c.decisao}`, text: c.decisao === "liberada" ? "Liberada" : "Vetada" }),
        el("p", { class: "cs-nota", html: md(c.nota) }),
        el("p", { class: "cs-comparacao" }),
      ),
    );
    // A turma vota; quem apresenta clica na escolha da maioria e o carimbo real cai.
    botoes.forEach((b) =>
      b.addEventListener("click", () => {
        if (!linha.classList.contains("ativa")) return;
        linha.dataset.voto = b.dataset.voto;
        botoes.forEach((x) => x.classList.toggle("escolhido", x === b));
        b.blur();
        setTimeout(() => ctx.acoes?.proximo(), 450);
      }),
    );
    return { linha, c };
  });

  const fala = s.citacao && citacao(s.citacao, "cs-cit");
  if (fala) fala.dataset.passo = linhas.length + 1;

  st.append(
    kicker(s.kicker),
    el("h2", { class: "cs-titulo", html: md(s.titulo) }),
    el("p", { class: "cs-instrucao", html: md(s.instrucao) }),
    el(
      "div",
      { class: "cs-tabela" },
      el(
        "div",
        { class: "cs-cabecalho", "aria-hidden": "true" },
        el("span"),
        el("span", { text: "Música" }),
        el("span", { text: "Trecho enviado à censura" }),
        el("span", { text: "A turma decide" }),
        el("span", { text: "A censura decidiu" }),
      ),
      linhas.map((l) => l.linha),
    ),
    fala,
  );

  const aoPasso = (n) => {
    linhas.forEach(({ linha, c }, i) => {
      const revelada = i < n;
      linha.classList.toggle("revelada", revelada);
      linha.classList.toggle("ativa", i === n);
      if (!revelada) {
        delete linha.dataset.voto;
        linha.querySelectorAll(".cs-voto").forEach((x) => x.classList.remove("escolhido"));
      }
      const voto = linha.dataset.voto;
      const igual = (voto === "liberar") === (c.decisao === "liberada");
      linha.querySelector(".cs-comparacao").textContent =
        revelada && voto ? (igual ? "A turma decidiu igual à censura." : "A turma decidiu diferente da censura.") : "";
    });
  };
  return { passos: linhas.length + (fala ? 1 : 0), aoPasso };
}

/* --------------------------------------------------------------- parecer */

function parecer(s, st, ctx) {
  const { box } = blocoLetra(ctx, { classe: "letra-doc", estrofes: [1, 2, 3, 4] });
  const doc = el(
    "div",
    { class: "pr-doc" },
    el("header", { class: "pr-cab" }, el("span", { class: "pr-orgao", text: s.orgao }), el("span", { class: "pr-tag", text: "Reconstrução" })),
    el("dl", { class: "pr-campos" }, s.campos.map((c) => el("div", { class: "pr-campo" }, el("dt", { text: c.rotulo }), el("dd", { html: md(c.valor) })))),
    el("div", { class: "pr-anot" }, el("span", { class: "pr-rot", text: "Anotação da censora" }), el("p", { text: `“${s.anotacao}”` })),
    el("div", { class: "pr-letra" }, el("span", { class: "pr-rot", text: "Letra submetida" }), box),
    el("footer", { class: "pr-acervo" }, el("span", { class: "pr-rot", text: "Acervo" }), el("span", { text: s.acervo })),
    el("div", { class: "carimbo", "data-passo": 1, role: "img", "aria-label": `carimbo: ${s.carimbo}` }, el("span", { text: s.carimbo })),
  );
  st.append(
    kicker(s.kicker),
    doc,
    el("aside", { class: "pr-lateral" }, s.lateral.map((l) => el("div", { class: "pr-item" }, el("h3", { text: l.titulo }), el("p", { html: md(l.texto) })))),
    el("p", { class: "pr-aviso", html: md(s.aviso) }),
  );
  return { passos: 1 };
}

/* --------------------------------------------------------------- análise */

function analise(s, st, ctx) {
  const { letra } = ctx;
  const { box, versos } = blocoLetra(ctx, { classe: "letra-analise", estrofes: s.estrofes, comVozes: true });
  // Só conta como passo o verso que tem algo riscado.
  const passos = versos.filter((v) => v.dataset.censurado === "1");
  const faltando = s.estrofes.filter((n) => !letra.estrofes[n - 1]);
  if (faltando.length) {
    box.append(el("p", { class: "an-aviso", text: `Estrofe ${faltando.join(", ")} não existe em content/letra.md. Ajuste "estrofes" em content/analise.json.` }));
  }

  // Mapa da letra inteira: cada verso é um tracinho. Mostra onde estamos e o que já foi liberado.
  const mapa = el("div", { class: "an-mapa", "aria-hidden": "true" });
  const marcasMapa = [];
  letra.estrofes.forEach((e, ei) => {
    const g = el("div", { class: `an-mapa-est${s.estrofes.includes(ei + 1) ? " atual" : ""}` });
    e.versos.forEach((v) => {
      const m = el("span", { style: { width: `${Math.min(100, 25 + v.length * 2.2)}%` } });
      if (ei + 1 < Math.min(...s.estrofes)) m.classList.add("livre");
      g.append(m);
      if (s.estrofes.includes(ei + 1)) marcasMapa.push(m);
    });
    mapa.append(g);
  });

  const painel = el(
    "aside",
    { class: "an-painel" },
    el("p", { class: "an-parte" }, el("span", { text: s.parte }), el("span", { class: "an-tempo", text: s.tempo })),
    el("h2", { class: "an-titulo", html: md(s.titulo) }),
    el("div", { class: "an-texto", "data-passo": 1 }, (s.texto || []).map((p) => el("p", { html: md(p) }))),
    s.inicio != null &&
      el(
        "button",
        { class: "an-ouvir", "data-acao": "trecho", "data-inicio": s.inicio },
        el("span", { class: "an-ouvir-icone", "aria-hidden": "true" }),
        `ouvir este trecho · ${fmtTempo(s.inicio)}`,
      ),
  );

  st.append(kicker(`Análise da letra · ${s.numero}/${s.total}`), box, mapa, painel);

  const aoPasso = (n) => {
    passos.forEach((v, i) => (i < n ? liberar(v) : tarjar(v)));
    // No mapa, o verso fica "livre" quando liberado (versos sem tarja contam como livres).
    versos.forEach((v, i) => {
      const k = passos.indexOf(v);
      marcasMapa[i]?.classList.toggle("livre", k === -1 || k < n);
    });
  };
  return { passos: passos.length, aoPasso };
}

/* ---------------------------------------------------------------- ao vivo */

function aoVivo(s, st) {
  st.append(
    el("div", { class: "av-ano", text: s.kicker }),
    el("h2", { class: "av-titulo", html: md(s.titulo) }),
    el("p", { class: "av-lead", html: md(s.lead) }),
    el("ul", { class: "av-pontos" }, s.pontos.map((p) => el("li", { html: md(p) }))),
    citacao(s.citacao, "av-cit"),
    el("p", { class: "av-rodape", html: md(s.rodape) }),
  );
}

/* ------------------------------------------------------------- fechamento */

function fechamento(s, st, ctx) {
  const e = s.esquerda;
  const d = s.direita;
  const tv = criarTV(
    e.slogans.map((t) => `“${t}”`),
    md(e.tvLegenda),
  );
  st.append(
    el("div", { class: "fe-lado fe-esq" }, el("h2", { html: md(e.titulo) }), el("p", { class: "fe-texto", html: md(e.texto) }), tv.el),
    el("div", { class: "fe-x", "aria-hidden": "true", "data-passo": 1, text: "×" }),
    el(
      "div",
      { class: "fe-lado fe-dir", "data-passo": 1 },
      el("h2", { html: md(d.titulo) }),
      el("p", { class: "fe-texto", html: md(d.texto) }),
      el("blockquote", { class: "fe-verso" }, el("p", { html: md(d.verso).split(" / ").join("<br>") }), el("footer", { class: "cit-ref", html: md(d.versoRef) })),
    ),
    el("div", { class: "fe-final", "data-passo": 2 }, el("span", { class: "fe-valor", text: s.final.valor }), el("p", { html: md(s.final.texto) })),
  );
  let anterior = 0;
  return {
    passos: 2,
    aoEntrar: () => tv.iniciar(),
    aoSair: () => tv.parar(),
    aoPasso: (n, { entrando } = {}) => {
      if (n >= 1) tv.desligar();
      else tv.ligar();
      // Desligou a propaganda: o disco volta a tocar (só quando se avança de 0 para 1).
      if (!entrando && anterior === 0 && n === 1 && s.musicaAoDesligar) ctx.acoes?.tocarMusica();
      anterior = n;
    },
  };
}

/* --------------------------------------------------------------- silêncio */

function silencio(s, st, ctx) {
  st.append(
    el("p", { class: "si-texto", html: md(s.texto) }),
    el("p", { class: "si-assinatura", text: s.assinatura }),
    el("div", { class: "si-vitrola" }, ctx.vitrolas.criar(s.capa)),
  );
  return {
    // A música some sozinha; quando para, o braço levanta e o disco desacelera.
    aoEntrar: () => ctx.audio?.esvaziar(s.fadeSegundos || 8),
  };
}

/* ------------------------------------------------------------ referências */

function encurtar(url) {
  try {
    const u = new URL(url);
    const caminho = decodeURIComponent(u.pathname).replace(/\/$/, "");
    const texto = u.hostname.replace(/^www\./, "") + caminho;
    return texto.length > 64 ? `${texto.slice(0, 61)}…` : texto;
  } catch {
    return url;
  }
}

function referencias(s, st, ctx) {
  const itens = Object.entries(ctx.fontes)
    .filter(([k]) => !k.startsWith("_"))
    .map(([, f]) =>
      el("li", {}, el("span", { class: "rf-txt", html: md(f.completa) }), f.url && el("a", { href: f.url, target: "_blank", rel: "noopener", text: encurtar(f.url) })),
    );
  const nomes = Object.values(ctx.grupo.integrantes || {});
  st.append(
    el("h2", { class: "rf-titulo", text: s.titulo }),
    el("ol", { class: "rf-lista" }, itens),
    el(
      "div",
      { class: "rf-rodape" },
      nomes.length && el("p", { class: "rf-grupo" }, el("b", { text: "Grupo" }), nomes.join(" · ")),
      el("p", { class: "rf-creditos", html: md(s.creditos) }),
    ),
  );
}

const RENDER = {
  abertura,
  tese,
  contexto,
  linha: linhaDoTempo,
  bio,
  parceiros,
  disco,
  censor,
  parecer,
  analise,
  aovivo: aoVivo,
  fechamento,
  silencio,
  referencias,
};
