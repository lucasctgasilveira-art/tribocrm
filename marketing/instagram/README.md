# Sistema Visual — Instagram TriboCRM

Sistema atômico de templates HTML/CSS standalone pra produção de peças do Instagram. Construído sobre [Bloco 1 — Estratégia](../../docs/instagram/01-estrategia-canal.md), [Bloco 2 — Pautas](../../docs/instagram/02-pautas-e-calendario.md) e o Brand Book em [docs/brand/](../../docs/brand/).

---

## Estrutura

```
marketing/instagram/
├── README.md                    ← este arquivo
├── tokens.css                   ← fonte da verdade do design system
├── _assets/
│   ├── symbol-d.svg             ← símbolo Conceito D oficial
│   └── logo.svg                 ← logo "Tribo" + "CRM"
└── templates/
    ├── carrossel-metodo-capa.html
    ├── carrossel-metodo-slide.html
    ├── carrossel-metodo-cta.html
    ├── carrossel-prova-capa.html
    ├── carrossel-prova-slide.html
    ├── carrossel-prova-cta.html
    ├── feed-manifesto.html
    ├── feed-citacao.html
    ├── reel-cover.html
    └── story-enquete.html
```

## Como usar

### Preview no navegador

Abrir qualquer template diretamente no Chrome/Edge:

```
file:///c:/Users/Doctum/tribocrm/marketing/instagram/templates/feed-manifesto.html
```

A página mostra a peça em escala reduzida (45-55%), centrada num fundo escuro neutro. As **dimensões reais** do canvas (`1080×1350` ou `1080×1920`) são preservadas — só o preview no navegador é escalado.

### Render pra PNG (pipeline)

#### Setup (1 vez)

```bash
cd marketing/instagram
npm install
```

Instala Puppeteer (~150MB, baixa Chromium) + js-yaml.

#### Renderizar uma pauta

```bash
npm run post -- --pauta posts/2026-05-04_funil_01-capa.yaml
```

Output em `output/2026-05-04_funil_01-capa.png` no tamanho nativo (1080×1350).

#### Renderizar todas as pautas em fila

```bash
npm run posts:all
```

Roda todos os YAMLs do diretório `posts/`. Reusa uma única instância do Chromium (mais rápido que N renders).

#### Como funciona

1. Lê o YAML da pauta (`template`, `slug`, `data`)
2. Carrega `templates/<template>.html` no Chromium headless
3. Pra cada elemento com `data-edit="X"`, substitui o `innerHTML` pelo valor de `data.X`
4. Espera fontes carregarem (`document.fonts.ready`)
5. Captura screenshot do `.canvas` no tamanho real do canvas (1080×1350 ou 1080×1920)
6. Salva PNG em `output/<slug>.png`

## Princípios do sistema

1. **Tokens.css é fonte única de verdade.** Nenhum template pode ter cor/tipografia hard-coded fora dos tokens.
2. **Cada template é standalone.** Abre direto no navegador, sem build step.
3. **Conteúdo é editável via `data-edit`.** Variáveis marcadas no HTML pra o pipeline saber onde substituir.
4. **Símbolo D + assinatura sempre presentes.** Convenção de marca não-negociável.
5. **DM Sans é a única tipografia.** Pesos 400/600/700/800 — nada além disso.
6. **Paleta:** preto `#0a0a0a` · laranja `#f97316` · branco `#ffffff`. Sem cinzas além de transparências do branco.

## Variáveis editáveis (convenção)

Cada template marca os pontos editáveis com `data-edit="<chave>"`. O pipeline (Bloco 4) lê essas chaves e substitui o conteúdo pelo valor correspondente do YAML de pauta.

Exemplo:

```html
<h1 class="t-h1" data-edit="titulo">Título da peça aqui</h1>
<p class="t-body t-dim" data-edit="legenda-slide">Subtexto contextual</p>
```

YAML de pauta:

```yaml
template: feed-manifesto
data:
  titulo: "Vender de verdade não é talento. É método."
  legenda-slide: ""
```

## Aspect ratios

| Template | Canvas | Uso |
|---|---|---|
| `carrossel-metodo-*` | 1080×1350 (4:5) | Carrossel principal — Pilar Método |
| `carrossel-prova-*` | 1080×1350 (4:5) | Carrossel de cases — Pilar Prova |
| `feed-manifesto` | 1080×1350 (4:5) | Feed estático — Pilar Manifesto |
| `feed-citacao` | 1080×1350 (4:5) | Citação curta com atribuição |
| `reel-cover` | 1080×1920 (9:16) | Capa de reel (Pilares Dor / Método / Bastidor) |
| `story-enquete` | 1080×1920 (9:16) | Story de engajamento |

## Estrutura completa do diretório

```
marketing/instagram/
├── README.md
├── package.json              ← deps: puppeteer + js-yaml
├── .gitignore                ← ignora node_modules/ e output/*.png
├── tokens.css
├── _assets/
│   ├── symbol-d.svg
│   └── logo.svg
├── templates/                ← 10 HTMLs (Bloco 3)
│   └── ...
├── scripts/
│   ├── render-post.mjs       ← CLI single-file
│   └── render-batch.mjs      ← CLI batch
├── posts/                    ← YAMLs de pauta
│   ├── 2026-05-04_funil_01-capa.yaml
│   ├── 2026-05-04_funil_03-momento1.yaml
│   ├── 2026-05-04_funil_08-cta.yaml
│   ├── 2026-05-05_reel-sexta-cover.yaml
│   └── 2026-05-06_feed-manifesto.yaml
└── output/                   ← PNGs gerados (não versionados)
```

## Próximo bloco

**Bloco 5 — Operação e Medição** vai amarrar o workflow semanal: ferramenta de agendamento (Metricool/Postgrain), dashboard de KPIs (saves/1k, DMs qualificadas, cliques link bio), checklist de publicação e ciclo de revisão mensal.
