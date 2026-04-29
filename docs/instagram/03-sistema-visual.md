# Bloco 3 — Sistema Visual de Templates

> Sistema atômico em HTML/CSS standalone. Construído em [marketing/instagram/](../../marketing/instagram/) e versionado em git.
> Pronto pro Bloco 4 (pipeline) consumir.

---

## Princípios

1. **Tokens.css é fonte única de verdade** — nenhum template hard-codeia cor ou tipografia
2. **Cada template é standalone** — abre direto no navegador, sem build step
3. **Conteúdo é editável via `data-edit`** — pipeline lê essas chaves e substitui
4. **Símbolo D + assinatura sempre presentes** — convenção de marca não-negociável
5. **DM Sans é a única tipografia** — pesos 400/500/600/700/800
6. **Paleta:** preto `#0a0a0a` · laranja `#f97316` · branco `#ffffff` (sem cinzas além de transparências)

---

## Estrutura de arquivos

```
marketing/instagram/
├── README.md                          ← guia de uso
├── tokens.css                         ← design system (variáveis CSS)
├── _assets/
│   ├── symbol-d.svg                   ← Conceito D oficial
│   └── logo.svg                       ← logo "Tribo" + "CRM"
└── templates/
    ├── carrossel-metodo-capa.html     ← capa do carrossel didático
    ├── carrossel-metodo-slide.html    ← slide intermediário (passo do método)
    ├── carrossel-metodo-cta.html      ← slide final com CTA laranja
    ├── feed-manifesto.html            ← frase única em DM Sans 800
    ├── feed-citacao.html              ← citação observacional (SEM autor)
    ├── reel-cover.html                ← capa de reel 9:16
    ├── story-enquete.html             ← story de engajamento A vs B
    └── _inactive/                     ← templates suspensos (Pilar PROVA · 28/04/2026)
        ├── carrossel-prova-capa.html  ← suspenso até cliente real com permissão
        ├── carrossel-prova-slide.html ← suspenso até cliente real com permissão
        └── carrossel-prova-cta.html   ← suspenso até cliente real com permissão
```

---

## Tokens principais

### Cores

| Token | Valor | Uso |
|---|---|---|
| `--tribo-black` | `#0a0a0a` | Fundo padrão de todas as peças |
| `--tribo-black-soft` | `#141414` | Superfície elevada (cards de story) |
| `--tribo-orange` | `#f97316` | Accent oficial · única cor de destaque |
| `--tribo-orange-deep` | `#ea580c` | Gradient destination (CTA slides) |
| `--tribo-white` | `#ffffff` | Texto principal sobre preto |
| `--tribo-white-soft` | `rgba(255,255,255,.85)` | Texto secundário |
| `--tribo-white-dim` | `rgba(255,255,255,.55)` | Meta-texto, números de slide |

### Tipografia

| Token | Tamanho | Uso |
|---|---|---|
| `--t-h1-xl` | 144px | Manifesto extra-grande |
| `--t-h1` | 116px | Capa principal, manifesto |
| `--t-h2` | 88px | Frase de impacto, título de slide |
| `--t-h3` | 64px | Sub-frase, citação |
| `--t-body-lg` | 48px | Corpo enfático |
| `--t-body` | 38px | Corpo geral |
| `--t-eyebrow` | 28px | Meta superior, eyebrow do pilar |

### Canvas

| Formato | Dimensão | Uso |
|---|---|---|
| `.canvas--feed` | 1080×1350 (4:5) | Carrossel · feed estático · manifesto · citação |
| `.canvas--square` | 1080×1080 (1:1) | Reservado pra futuras necessidades |
| `.canvas--story` | 1080×1920 (9:16) | Story · reel cover |

---

## Os 10 templates

| # | Template | Canvas | Variáveis editáveis |
|---|---|---|---|
| 1 | `carrossel-metodo-capa.html` | 1080×1350 | `pilar` `titulo` `slide-number` `handle` |
| 2 | `carrossel-metodo-slide.html` | 1080×1350 | `pilar` `step-num` `titulo` `body-1` `body-2` `slide-number` `handle` |
| 3 | `carrossel-metodo-cta.html` | 1080×1350 | `titulo` `direcional` `handle` `tagline` `slide-number` |
| 4 | `feed-manifesto.html` | 1080×1350 | `linha-1` `linha-2` `linha-3` `handle` |
| 5 | `feed-citacao.html` | 1080×1350 | `citacao` `fonte` `handle` (SEM autor/cargo — só observação genérica) |
| 6 | `reel-cover.html` | 1080×1920 | `pilar` `titulo` `meta` `handle` |
| 7 | `story-enquete.html` | 1080×1920 | `pilar` `pergunta` `opcao-a` `opcao-b` `cta` `handle` |
| — | `_inactive/carrossel-prova-*.html` (3) | — | **SUSPENSOS** em 28/04/2026 — reativam com cliente real + permissão escrita |

---

## Convenção `data-edit`

Cada ponto editável do template é marcado com `data-edit="<chave>"`. O pipeline (Bloco 4) lê essas chaves e substitui o conteúdo pelo valor correspondente do YAML de pauta.

**Exemplo no template:**

```html
<h1 class="t-h1" data-edit="titulo">Os 4 momentos do funil...</h1>
<span class="brand-signature" data-edit="handle">@tribocrmoficial</span>
```

**YAML de pauta correspondente:**

```yaml
template: carrossel-metodo-capa
data:
  pilar: "Método"
  titulo: "Os 4 momentos do funil que sua PME tá pulando"
  slide-number: "01 / 08"
  handle: "@tribocrmoficial"
```

O pipeline substitui o `innerHTML` ou `textContent` de cada elemento marcado, renderiza via Puppeteer, e salva o PNG.

---

## Como abrir um template no navegador

```
file:///c:/Users/Doctum/tribocrm/marketing/instagram/templates/feed-manifesto.html
```

Cada arquivo abre num **preview-stage** (fundo escuro neutro) com o canvas escalado pra caber na tela. As **dimensões reais** (1080×1350 ou 1080×1920) ficam preservadas — o Puppeteer captura o canvas no tamanho nativo.

---

## Render para PNG (preview do Bloco 4)

O pipeline de automação vai:

1. Ler pauta YAML do calendário (Bloco 2)
2. Selecionar template apropriado (campo `template:` do YAML)
3. Substituir cada `data-edit="X"` pelo valor de `data.X`
4. Lançar Chromium headless via Puppeteer
5. Capturar screenshot do `.canvas` em 1080×1350 ou 1080×1920
6. Salvar em `marketing/instagram/output/<data>/<slug>.png`

CLI alvo: `npm run post -- --pauta posts/2026-05-04-funil-capa.yaml`

---

## Próximo bloco

Aprovação do Bloco 3 destrava o **Bloco 4 — Pipeline de Automação**:

- `package.json` com Puppeteer + js-yaml
- Script Node `scripts/render-post.mjs` (CLI)
- Estrutura `marketing/instagram/posts/` pra YAMLs de pauta
- Estrutura `marketing/instagram/output/` pra PNGs gerados
- Workflow ponta-a-ponta: pauta YAML → HTML render → PNG export
- Preset de tamanhos por template (auto-detect via `data-format`)

---

## ✅ Checklist de aprovação

- [ ] Hierarquia tipográfica funciona (h1 116px é forte? h2 88px lê bem?)
- [ ] Paleta preto/laranja/branco resolve sem precisar de cinzas
- [ ] Símbolo D no canto inferior direito tá no tamanho certo (88px)
- [ ] Os 7 templates ativos cobrem os formatos do Bloco 2 (carrossel-método, feed-manifesto, feed-citação, reel-cover, story-enquete) — `carrossel-prova-*` em `_inactive/` desde 28/04 (Pilar PROVA suspenso)
- [ ] Convenção `data-edit` é clara e fácil pro Bloco 4 consumir
- [ ] CTA gradient laranja → laranja-deep funciona como slide final
- [ ] Manifesto em h1-xl (144px) tem peso suficiente
- [ ] Falta algum tipo de template? (story-bastidor? carrossel-dor? feed-com-foto?)

> Marca os pontos a ajustar ou diz "Bora!" pra eu seguir pro Bloco 4.
