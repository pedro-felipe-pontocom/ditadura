// Canal entre a apresentação e a janela do modo apresentador (mesma origem).
//
// apresentação → apresentador: { tipo: "roteiro", slides }, { tipo: "estado", index, passo },
//                               { tipo: "audio", tocando, tempo, duracao, modo }
// apresentador → apresentação: { tipo: "ola" }, { tipo: "nav", acao, index? },
//                               { tipo: "audio", acao: "alternar" }, { tipo: "blackout" }

export const CANAL = "hoje-e-dia-de-el-rey";

export function abrirCanal(aoReceber) {
  if (!("BroadcastChannel" in window)) {
    console.warn("[sync] BroadcastChannel indisponível: o modo apresentador não vai sincronizar.");
    return { enviar() {}, fechar() {} };
  }
  const bc = new BroadcastChannel(CANAL);
  bc.onmessage = (e) => aoReceber?.(e.data);
  return {
    enviar: (msg) => bc.postMessage(msg),
    fechar: () => bc.close(),
  };
}
