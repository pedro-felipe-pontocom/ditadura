// Carrega todo o conteúdo editável (content/*.json e content/letra.md).

const ARQUIVOS = {
  config: "content/config.json",
  roteiro: "content/slides.json",
  analise: "content/analise.json",
  grupo: "content/grupo.json",
  fontes: "content/fontes.json",
  letra: "content/letra.md",
};

export class ErroConteudo extends Error {
  constructor(arquivo, mensagem) {
    super(mensagem);
    this.arquivo = arquivo;
  }
}

async function buscar(url, comoTexto = false) {
  let resp;
  try {
    resp = await fetch(url, { cache: "no-cache" });
  } catch {
    throw new ErroConteudo(
      url,
      "Não foi possível ler o arquivo. Abra o site por um servidor local (por exemplo: npx serve .) em vez de abrir o index.html direto.",
    );
  }
  if (!resp.ok) throw new ErroConteudo(url, `Arquivo não encontrado (HTTP ${resp.status}).`);
  const texto = await resp.text();
  if (comoTexto) return texto;
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw new ErroConteudo(url, descreverErroJson(texto, e));
  }
}

// Mensagem de erro amigável para quem editou um JSON e quebrou uma vírgula.
function descreverErroJson(texto, e) {
  let linha;
  let coluna;
  const lc = /line (\d+) column (\d+)/.exec(e.message);
  const pos = /position (\d+)/.exec(e.message);
  if (lc) {
    linha = +lc[1];
    coluna = +lc[2];
  } else if (pos) {
    const antes = texto.slice(0, +pos[1]);
    linha = antes.split("\n").length;
    coluna = antes.length - antes.lastIndexOf("\n");
  }
  let trecho = "";
  if (linha) {
    const linhas = texto.split("\n");
    const ini = Math.max(0, linha - 3);
    trecho = linhas
      .slice(ini, linha + 1)
      .map((l, i) => `${String(ini + i + 1).padStart(4)} | ${l}`)
      .join("\n");
  }
  return [
    `JSON inválido${linha ? ` perto da linha ${linha}, coluna ${coluna}` : ""}.`,
    e.message,
    "",
    trecho,
    "",
    "Dica: confira se não sobrou vírgula no fim de uma lista e se todas as aspas são duplas (\").",
  ].join("\n");
}

/**
 * Lê content/letra.md: um verso por linha, estrofes separadas por linha em branco,
 * [Filho]/[Pai]/[Ambos] opcional no início da estrofe. Comentários <!-- --> são ignorados.
 */
export function parseLetra(md) {
  const linhas = md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  let placeholder = false;
  const estrofes = [];
  let atual = null;
  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (linha === "PLACEHOLDER") {
      placeholder = true;
      continue;
    }
    if (linha.startsWith("#")) continue;
    if (!linha) {
      atual = null;
      continue;
    }
    if (!atual) {
      atual = { voz: null, versos: [] };
      estrofes.push(atual);
    }
    const voz = /^\[(.+)\]$/.exec(linha);
    if (voz && atual.versos.length === 0 && !atual.voz) {
      atual.voz = voz[1].trim();
      continue;
    }
    atual.versos.push(linha);
  }
  return { placeholder, estrofes: estrofes.filter((e) => e.versos.length) };
}

function montarSlides(roteiro, analise, grupo) {
  const lista = [];
  for (const s of roteiro.slides || []) {
    if (s.tipo === "analise") {
      const trechos = analise.trechos || [];
      trechos.forEach((t, i) =>
        lista.push({
          tema: "papel",
          ...t,
          tipo: "analise",
          id: t.id || `analise-${i + 1}`,
          numero: i + 1,
          total: trechos.length,
        }),
      );
    } else {
      lista.push(s);
    }
  }

  const vistos = new Set();
  lista.forEach((s, i) => {
    if (!s.id) s.id = `slide-${i + 1}`;
    if (vistos.has(s.id)) console.warn(`[conteúdo] id de slide repetido: ${s.id}`);
    vistos.add(s.id);
  });

  // Quem apresenta cada slide (content/grupo.json).
  const nomes = grupo.integrantes || {};
  const divisao = grupo.divisao || {};
  for (const s of lista) {
    const chave = divisao[s.id];
    if (!chave) s.apresentador = "";
    else if (chave === "todos") s.apresentador = "Todo o grupo";
    else s.apresentador = nomes[chave] || chave;
  }
  return lista;
}

export async function carregarConteudo() {
  const [config, roteiro, analise, grupo, fontes, letraMd] = await Promise.all([
    buscar(ARQUIVOS.config),
    buscar(ARQUIVOS.roteiro),
    buscar(ARQUIVOS.analise),
    buscar(ARQUIVOS.grupo),
    buscar(ARQUIVOS.fontes),
    buscar(ARQUIVOS.letra, true),
  ]);
  const letra = parseLetra(letraMd);
  if (letra.placeholder) {
    console.info("[conteúdo] content/letra.md ainda está com o texto de exemplo (linha PLACEHOLDER).");
  }
  return {
    config,
    fontes,
    grupo,
    letra,
    slides: montarSlides(roteiro, analise, grupo),
  };
}
