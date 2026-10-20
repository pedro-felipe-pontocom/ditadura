// Tarjas de "pincel atômico": cada trecho censurado ganha um traço SVG próprio,
// com bordas irregulares, gerado a partir de uma semente fixa.

import { el, hashString, mulberry32 } from "./util.js";

const cache = new Map();

function traco(r, W, H, recuo) {
  const n = 16;
  const x0 = 4 + r() * 3 + recuo;
  const x1 = W - 5 - r() * 4 - recuo;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, 2.2 + recuo * 0.35 + r() * 2.6]);
  }
  pts.push([x1 + 1.5 + r() * 2.5, H * 0.5 + (r() - 0.5) * 4]);
  for (let i = n; i >= 0; i--) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, H - 2.2 - recuo * 0.35 - r() * 2.6]);
  }
  pts.push([x0 - 1.5 - r() * 2.5, H * 0.5 + (r() - 0.5) * 4]);
  return "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
}

/** Fundo CSS com um traço de marcador (data URI). */
export function marca(semente, cor) {
  const chave = `${semente}|${cor}`;
  if (cache.has(chave)) return cache.get(chave);
  const r = mulberry32(semente);
  const W = 240;
  const H = 24;
  // Duas passadas do pincel e dois veios mais claros, como tinta de marcador.
  const veios = [0, 1]
    .map(() => {
      const y = 7 + r() * 10;
      return `<path d="M${10 + r() * 30},${y.toFixed(1)}L${(120 + r() * 100).toFixed(1)},${(y + (r() - 0.5) * 2).toFixed(1)}" stroke="#ebe4d6" stroke-opacity=".07" stroke-width="1.1" fill="none"/>`;
    })
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<path d="${traco(r, W, H, 0)}" fill="${cor}"/>` +
    `<path d="${traco(r, W, H, 1.6)}" fill="${cor}" opacity=".85"/>` +
    veios +
    `</svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  cache.set(chave, url);
  return url;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Divide o verso entre o que a censura riscou e o que deixou passar. */
export function segmentar(verso, palavras = []) {
  if (!palavras.length) return [{ texto: verso, sobrevivente: false }];
  const padrao = new RegExp(`(${palavras.map(escRe).join("|")})`, "gi");
  const lower = palavras.map((p) => p.toLowerCase());
  return verso
    .split(padrao)
    .filter((p) => p !== "")
    .map((p) => ({ texto: p, sobrevivente: lower.includes(p.toLowerCase()) }));
}

/**
 * Cria o <span class="verso"> com as tarjas.
 * opts: { palavras, chave, cor, placeholder }
 */
export function criarVerso(texto, opts = {}) {
  const verso = el("span", { class: "verso" });
  let conteudo = texto;
  if (opts.placeholder) {
    // Sem a letra real, os traços ganham comprimentos variados para não parecerem iguais.
    const r = mulberry32(hashString(opts.chave || texto));
    conteudo = `${texto} ${"·".repeat(6 + Math.floor(r() * 22))}`;
  }
  let n = 0;
  for (const s of segmentar(conteudo, opts.palavras)) {
    if (s.sobrevivente) {
      verso.append(el("span", { class: "seg sobrevivente", text: s.texto }));
      continue;
    }
    // Espaços nas pontas ficam fora da tarja.
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.texto);
    if (m[1]) verso.append(m[1]);
    if (m[2]) {
      const seg = el("span", { class: "seg tarjado", text: m[2] });
      seg.style.backgroundImage = marca(hashString(`${opts.chave || ""}#${n++}`), opts.cor || "#11100e");
      verso.append(seg);
    }
    if (m[3]) verso.append(m[3]);
  }
  verso.dataset.censurado = verso.querySelector(".seg.tarjado") ? "1" : "0";
  return verso;
}

export function liberar(verso) {
  verso.querySelectorAll(".seg.tarjado").forEach((s) => s.classList.add("liberado"));
}

export function tarjar(verso) {
  verso.querySelectorAll(".seg.tarjado").forEach((s) => s.classList.remove("liberado"));
}

/** Uma barra de tarja solta (sem texto), para ilustrar uma letra vetada. */
export function barra(chave, largura, cor) {
  const b = el("span", { class: "barra" });
  b.style.width = `${largura}%`;
  b.style.backgroundImage = marca(hashString(chave), cor);
  return b;
}
