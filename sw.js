// Service worker: deixa a apresentação funcionar sem internet depois da primeira visita
// (útil se ela estiver publicada e a rede da escola cair).
// Estratégia: sempre tenta a rede primeiro; só usa a cópia guardada se a rede falhar.
// Assim, qualquer edição no conteúdo aparece na hora.

const CACHE = "el-rey-v2";
const AUDIO = "assets/audio/hoje-e-dia-de-el-rey.mp3";
const ARQUIVOS = [
  "./",
  "index.html",
  "presenter.html",
  "css/fonts.css",
  "css/base.css",
  "css/slides.css",
  "css/presenter.css",
  "js/main.js",
  "js/util.js",
  "js/content.js",
  "js/tarja.js",
  "js/render.js",
  "js/deck.js",
  "js/audio.js",
  "js/voz.js",
  "js/sync.js",
  "js/vitrola.js",
  "js/tv.js",
  "js/presenter.js",
  "content/config.json",
  "content/slides.json",
  "content/analise.json",
  "content/grupo.json",
  "content/fontes.json",
  "content/letra.md",
  "assets/fonts/big-shoulders-display-normal-latin.woff2",
  "assets/fonts/big-shoulders-display-normal-latin-ext.woff2",
  "assets/fonts/newsreader-normal-latin.woff2",
  "assets/fonts/newsreader-normal-latin-ext.woff2",
  "assets/fonts/newsreader-italic-latin.woff2",
  "assets/fonts/newsreader-italic-latin-ext.woff2",
  AUDIO,
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(ARQUIVOS.map((u) => c.add(u).catch(() => {})))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // O <audio> pede pedaços do arquivo (Range). Online: rede. Offline: fatia da cópia.
  if (req.headers.has("range")) {
    e.respondWith(pedaco(req, url));
    return;
  }

  e.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok && resp.type === "basic") {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error())),
  );
});

async function pedaco(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const resp = await fetch(req);
    // Garante uma cópia inteira do áudio para o dia em que não houver rede.
    if (url.pathname.endsWith(".mp3")) {
      cache.match(url.href).then((tem) => {
        if (!tem) fetch(url.href).then((r) => r.ok && cache.put(url.href, r)).catch(() => {});
      });
    }
    return resp;
  } catch {
    const inteiro = await cache.match(url.href, { ignoreSearch: true });
    if (!inteiro) return Response.error();
    const buf = await inteiro.arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
    const ini = m && m[1] ? Number(m[1]) : 0;
    const fim = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(ini, fim + 1), {
      status: 206,
      headers: {
        "Content-Type": inteiro.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": `bytes ${ini}-${fim}/${buf.byteLength}`,
        "Content-Length": String(fim - ini + 1),
        "Accept-Ranges": "bytes",
      },
    });
  }
}
