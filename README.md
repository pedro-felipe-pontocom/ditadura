# Hoje é Dia de El-Rey: a voz sem palavras

Apresentação em slides para o trabalho de História sobre a Ditadura Civil-Militar.
A canção de Milton Nascimento e Márcio Borges (*Milagre dos Peixes*, EMI-Odeon, 1973)
teve a letra inteira riscada pela censura. Só duas palavras sobraram, "Filho meu".
Milton gravou cantando sem palavras.

No site, a voz da música desenha uma serra mineira em tempo real (Web Audio API).
A letra aparece tarjada, e o grupo vai liberando verso por verso na análise.

HTML, CSS e JavaScript puros. Não precisa de instalação nem de build e funciona sem internet.

---

## 1. Abrir

O site precisa de um servidor local (o navegador bloqueia JSON e módulos JS abertos direto do arquivo).

```bash
npx serve .
```

Abra o endereço que aparecer (normalmente http://localhost:3000).

Sem Node, dá para usar o Python: `python -m http.server 8000` e abrir http://localhost:8000.

## 2. Colocar letra, áudio e nomes

| O quê | Onde | Como |
|---|---|---|
| **Letra** | `content/letra.md` | Apague a linha `PLACEHOLDER` e cole a letra: um verso por linha, estrofes separadas por linha em branco, e `[Filho]`, `[Pai]` ou `[Ambos]` na primeira linha de cada estrofe. As instruções estão no topo do arquivo. |
| **Áudio** | `assets/audio/hoje-e-dia-de-el-rey.mp3` | Use a gravação original do LP (cerca de 6:55). Sem o arquivo, o site usa o YouTube (precisa de internet) e a serra não reage à voz. |
| **Nomes e divisão** | `content/grupo.json` | Troque "Integrante 1"... pelos nomes. Em `divisao`, diga quem apresenta cada slide. |

A análise (`content/analise.json`) segue a **letra vetada** reproduzida em Coan (2020, p. 138–139):
9 estrofes, na ordem Filho, Pai, Filho, Pai, Filho, Ambos, Pai, Filho, Ambos. Se a letra colada tiver
outra divisão, ajuste o campo `estrofes` de cada trecho.

Todo o resto do texto está em `content/slides.json`, e as referências em `content/fontes.json`.
Nos textos, `*assim*` vira itálico e `**assim**` vira destaque. Se um JSON quebrar
(uma vírgula sobrando, por exemplo), a página mostra o arquivo e a linha do erro.

## 3. Apresentar

| Tecla | Ação |
|---|---|
| → ↓ espaço Enter PageDown | avança (libera o próximo verso, marco ou carimbo) |
| ← ↑ PageUp Backspace | volta |
| Home / End | primeiro / último slide |
| **F** | tela cheia |
| **N** | modo apresentador (janela separada) |
| **K** ou **P** | toca/pausa a música |
| **B** ou **.** | tela preta (o botão de "blank" do passador) |
| clique | avança (clique na borda esquerda volta) |
| celular | deslize para os lados |

- Funciona com passador de slides, que manda PageUp/PageDown.
- A música não para ao trocar de slide. O controle (um disquinho que gira) fica no canto inferior direito.
- O primeiro play precisa de clique (é regra do navegador): clique no disco da abertura.
- Quando "filho meu" soa na gravação (0:57, 2:04 e 3:09), as palavras acendem em vermelho na tela.

### Momentos interativos
| Slide | O que acontece |
|---|---|
| Abertura | **Vitrola**: clique no disco. Ele sai da capa, vai para o prato, o braço desce, a agulha estala e a música começa. O braço avança devagar conforme a faixa toca. Clique de novo para parar. |
| Tese | Clique em **"Filho meu."**: a música pula para o segundo em que essas palavras são cantadas, e elas acendem. |
| Linha do tempo | Clique em qualquer ano para ir direto a ele. |
| O disco | Clique na **folha do encarte**: ela vira e mostra as 11 faixas e o que a censura fez com cada uma. |
| Liberar ou vetar? | A turma vota em 3 trechos reais; clique na escolha da maioria e o **carimbo real** cai, dizendo se a turma decidiu igual à censura. |
| Análise | Cada seta tira a tarja de um verso. "Ouvir este trecho" toca a parte certa da música. |
| Fechamento | A **TV dos anos 70** passa os slogans do regime (clique para trocar de canal). Na seta seguinte, a TV desliga e o disco volta a tocar. |
| Silêncio | A música some sozinha, o braço da vitrola levanta e o disco para. |

### Quem apresenta
| Integrante | Slides |
|---|---|
| Pedro | Abertura, Tese, Fechamento, Silêncio |
| Leandro | Contexto, Linha do tempo, Ao vivo (1974) |
| Matheus | Biografia, Parceiros, O disco |
| Luis Miguel | Liberar ou vetar?, Parecer, Análise 1 |
| Maria Eduarda | Análise 2 a 5 |

A fala de cada um está nas notas do modo apresentador (tecla **N**) e em `content/slides.json` e `content/analise.json`.
- **Modo apresentador (N):** mostra o slide atual e o próximo, as notas de fala, um cronômetro e o
  controle da música, e avisa quando muda o apresentador. Coloque essa janela no notebook e a
  apresentação no projetor.
- O endereço guarda o slide atual (`#/parecer/1`). Se recarregar a página, ela volta para o mesmo ponto.

### No dia
1. Leve a pasta inteira num pen drive, com o mp3. Rode `npx serve .` no computador da escola,
   ou abra o link publicado (veja abaixo).
2. Teste no projetor antes: tecla F, volume, passador.
3. Se publicar no GitHub Pages e abrir o link uma vez com internet, o site fica guardado no navegador
   e abre mesmo se a rede cair depois.

## 4. Publicar

### GitHub Pages
```bash
git init
git add .
git commit -m "Apresentação Hoje é Dia de El-Rey"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/el-rey.git
git push -u origin main
```
No GitHub, abra **Settings → Pages → Build and deployment**. Escolha *Deploy from a branch*,
a branch `main` e a pasta `/ (root)`, e salve. Em 1 ou 2 minutos o site fica em
`https://SEU-USUARIO.github.io/el-rey/`.

> **Sobre o áudio:** um repositório público deixa o mp3 acessível para qualquer pessoa. Se preferir não
> publicar a faixa, não envie o mp3 (`git rm --cached assets/audio/hoje-e-dia-de-el-rey.mp3`).
> O site publicado usa o YouTube, e na sala vocês apresentam a versão local, com o arquivo.

### Vercel
`npx vercel` dentro da pasta, ou importe o repositório em vercel.com. Não precisa configurar nada:
o site é estático.

## 5. Estrutura

```
index.html          apresentação
presenter.html      modo apresentador (tecla N)
sw.js               cópia offline (sempre tenta a rede primeiro)
css/
  fonts.css         fontes locais
  base.css          paleta, palco 16:9, controles, tarjas, transição
  slides.css        composição de cada slide
  presenter.css
js/
  main.js           inicialização
  content.js        lê content/ (JSON + letra.md)
  render.js         monta cada tipo de slide
  deck.js           navegação, passos, teclado, swipe, transição
  audio.js          mp3 + Web Audio (AnalyserNode) ou YouTube
  voz.js            a serra desenhada pela voz (canvas)
  vitrola.js        a vitrola (disco, braço, 33⅓ rpm) — controla a música
  tv.js             a TV da propaganda (slogans, chiado, desligar)
  tarja.js          tarjas de "pincel atômico" (SVG gerado)
  sync.js           canal com o modo apresentador (BroadcastChannel)
  presenter.js
content/            TODO o texto (editar aqui)
  slides.json  analise.json  fontes.json  grupo.json  config.json  letra.md
assets/
  fonts/            Big Shoulders Display + Newsreader (SIL OFL)
  audio/            coloque o mp3 aqui
```

Para limpar a cópia offline do navegador, abra o site com `?semcache` no fim do endereço.

## 6. Pendências de verificação (TODO)

Itens que não consegui confirmar na fonte primária. Os que não foram confirmados **ficaram fora dos slides**.

1. **YouTube** (`content/config.json`): o ID `GnHn2RYB2Cg` é um upload de fã com a faixa completa (6:56).
   Confirmem que ainda está no ar. Os uploads oficiais da Universal são `EqeJdVbS2Vc` (versão de
   streaming, só 2:29) e `3h6UKLgGBHw` (ao vivo, 1974).
2. **Data do veto** de "Hoje é dia de El-Rey": não está nas fontes, então o parecer não tem data.
   O número do documento (TN.CPR.LMU.19932) vem de Holmes (2017).
3. **"Milagre econômico" em números**: 11,1% ao ano (1968–1973), segundo Veloso, Villela e Giambiagi (2008).
   Não abri a fonte primária, então o número não está no slide.
4. **Voz "agressiva"**: vem de Holmes (2017, p. 168), que não cita o documento da censura nesse ponto.
5. **Família de Milton** (nomes da mãe e dos pais adotivos): vem da Wikipédia, sem fonte no parágrafo.
   Dá para confirmar em Duarte (2009) ou na Enciclopédia Itaú Cultural.
6. **Minutagem**: as partes (0:57, 2:04, 3:07) vêm da reedição em CD de 2012 (Silva e Teixeira, 2023), e
   os "filho meu" (0:57, 2:04, 3:09) vêm de Holmes (2017). Confiram com o mp3 de vocês e preencham o
   `inicio` do último trecho em `content/analise.json`.
7. **Data de lançamento**: a Universal informa 2/4/1973, mas o veto de "Os escravos de Jó" é de 4/4/1973
   e a liberação parcial, de 5/5/1973. Holmes fala em junho de 1973. Por isso os slides dizem só "1973".
8. **Nome do órgão**: em 1973 as fontes falam em Serviço de Censura de Diversões Públicas (SCDP). Ele passou
   a se chamar DCDP por volta de 1972–73 (as fontes divergem), então o slide usa o nome do serviço.

Uma correção de premissa: o disco **ao vivo** de 1974 **não** devolveu as letras vetadas.
"Hoje é Dia de El-Rey" continuou sem palavras, só com "Filho meu!", e "Os escravos de Jó" e "Cadê" não
estão no repertório. O disco tem letra em 12 das 16 faixas e inclui "Bodas", que a gravadora tinha
barrado (Holmes, 2017, cap. 6).

## 7. Fontes principais

- COAN, E. I. “Milagre dos peixes”: a censura e a voz de Milton Nascimento… *Alterjor*, 2020.
- SILVA, L. M.; TEIXEIRA, W. Cantando lo no dicho… *Cuadernos de Música Iberoamericana*, 2023.
- HOLMES, H. L. *Milton Nascimento and the Clube da Esquina…* Tese, University of Illinois, 2017.
- HERDY, T. O encontro que a censura impediu. *Documentos Revelados*, 2015.
- Legislação em planalto.gov.br (AI-5, DL 1.077/1970, EC 11/1978, Lei 6.683/1979).

A lista completa, com links, está no último slide e em `content/fontes.json`.
