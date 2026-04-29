# Bloco 4 — Pipeline de Automação

> Orquestrador Node + Puppeteer que transforma pauta YAML em PNG.
> Construído em [marketing/instagram/](../../marketing/instagram/).

---

## Arquitetura

```
[ posts/2026-05-04_funil_01-capa.yaml ]
              ↓
       template: carrossel-metodo-capa
              ↓
   render-post.mjs (Puppeteer + Chromium headless)
              ↓
   templates/carrossel-metodo-capa.html
              ↓
   substitui [data-edit="X"] pelo valor de data.X
              ↓
   espera document.fonts.ready
              ↓
   screenshot do .canvas no tamanho nativo
              ↓
   output/2026-05-04_funil_01-capa.png  (1080×1350 / 1080×1920)
```

---

## Setup (uma vez)

```bash
cd marketing/instagram
npm install
```

Instala:
- `puppeteer ^23.0.0` (~150MB, baixa Chromium)
- `js-yaml ^4.1.0`

Engines: Node ≥ 18 (usa `import`, `parseArgs` nativo, top-level `await`).

---

## CLI

### Renderizar uma pauta

```bash
npm run post -- --pauta posts/2026-05-04_funil_01-capa.yaml
```

Saída no console:

```
▶ 2026-05-04_funil_01-capa.yaml
✓ carrossel-metodo-capa → 2026-05-04_funil_01-capa.png
  1080×1350 · 1.4s · output/2026-05-04_funil_01-capa.png
```

### Renderizar tudo em fila

```bash
npm run posts:all
```

Reusa uma única instância do Chromium — muito mais rápido que N renders independentes:

```
▶ 5 pautas em fila
  ✓ 2026-05-04_funil_01-capa.yaml      → 1080×1350
  ✓ 2026-05-04_funil_03-momento1.yaml  → 1080×1350
  ✓ 2026-05-04_funil_08-cta.yaml       → 1080×1350
  ✓ 2026-05-05_reel-sexta-cover.yaml   → 1080×1920
  ✓ 2026-05-06_feed-manifesto.yaml     → 1080×1350

5 ok · 0 falhas · 4.8s
```

### Renderizar diretório customizado

```bash
npm run posts:all -- --dir posts/2026-05  # (se você organizar por mês)
```

---

## Anatomia de uma pauta YAML

```yaml
# Comentários no topo: contexto do calendário
template: carrossel-metodo-capa     # nome do arquivo em templates/ (sem .html)
slug: 2026-05-04_funil_01-capa      # opcional — se ausente, usa o nome do YAML
data:
  pilar: "Método"
  titulo: |
    Os 4 momentos do funil<br>
    que sua PME tá <span class="t-orange">pulando</span>.
  slide-number: "01 / 08"
  handle: "@tribocrmoficial"
```

### Campos obrigatórios

| Campo | Tipo | Uso |
|---|---|---|
| `template` | string | Nome do template em `templates/<nome>.html` |
| `data` | object | Valores que vão preencher cada `data-edit="X"` do template |

### Campos opcionais

| Campo | Default | Uso |
|---|---|---|
| `slug` | nome do YAML | Nome do PNG de saída |

### Como conteúdo HTML é tratado

O pipeline usa **`innerHTML`** pra substituir cada elemento, então você pode incluir HTML inline:

- `<br>` pra quebra de linha
- `<span class="t-orange">palavra</span>` pra destacar palavra em laranja
- `<span class="cta-emoji">🔥</span>` pra emoji no slide CTA
- `<strong>` pra ênfase

YAML multilinha com `|` preserva quebras visuais e permite HTML limpo:

```yaml
titulo: |
  Sexta às 18h:<br>
  ninguém sabe<br>
  quanto fechou<br>
  na <span class="t-orange">semana</span>.
```

---

## Como o pipeline funciona internamente

`scripts/render-post.mjs` faz, por pauta:

1. **Lê o YAML** (js-yaml.load)
2. **Resolve o template** (`templates/<template>.html`)
3. **Lança Chromium** headless via Puppeteer (viewport 1200×2000 — cobre feed e story)
4. **Carrega o template** via `file://` URL
5. **Injeta CSS de produção** que desabilita o `.preview-stage` scaling — canvas renderiza em tamanho nativo
6. **Substitui** cada `[data-edit="X"]` pelo valor de `data.X` via `page.evaluate`
7. **Espera fontes** com `document.fonts.ready` (DM Sans precisa estar carregada)
8. **Mede o `.canvas`** com `boundingBox()` pra reportar dimensão real
9. **Captura screenshot** do elemento `.canvas` (não da viewport inteira) → PNG limpo, sem stage de preview ao redor
10. **Salva** em `output/<slug>.png`

`scripts/render-batch.mjs` faz o mesmo em loop, reusando a instância do browser.

---

## As 5 pautas-exemplo entregues

Pautas reais do calendário Mês 1 (Bloco 2), prontas pra você renderizar:

| Arquivo YAML | Template | Pilar | Calendário |
|---|---|---|---|
| `2026-05-04_funil_01-capa.yaml` | carrossel-metodo-capa | Método | SEG 04/05 — slide 1 |
| `2026-05-04_funil_03-momento1.yaml` | carrossel-metodo-slide | Método | SEG 04/05 — slide 3 |
| `2026-05-04_funil_08-cta.yaml` | carrossel-metodo-cta | Método | SEG 04/05 — slide 8 |
| `2026-05-05_reel-sexta-cover.yaml` | reel-cover | Dor da PME | TER 05/05 |
| `2026-05-06_feed-manifesto.yaml` | feed-manifesto | Manifesto | QUA 06/05 |

Demonstram os principais formatos: capa de carrossel, slide miolo, CTA gradient laranja, reel 9:16 e feed manifesto 4:5.

---

## Estrutura de arquivos

```
marketing/instagram/
├── package.json              ← deps + scripts npm
├── .gitignore                ← ignora node_modules/ + output/*.png
├── README.md
├── tokens.css                ← design system
├── _assets/                  ← símbolo D + logo SVG
├── templates/                ← 10 HTMLs (Bloco 3)
├── scripts/
│   ├── render-post.mjs       ← single-file CLI
│   └── render-batch.mjs      ← batch CLI (reusa browser)
├── posts/                    ← YAMLs de pauta
└── output/                   ← PNGs gerados (não versionados)
```

---

## Troubleshooting

### `Error: Failed to launch the browser process`

Puppeteer baixa o próprio Chromium na instalação. Se falhou, rode:

```bash
cd marketing/instagram
npx puppeteer browsers install chrome
```

### Fonte DM Sans aparece como serif/Times

O template puxa Google Fonts via `@import` no `tokens.css`. O pipeline espera `document.fonts.ready` antes de capturar — em rede lenta, aumenta o `setTimeout` em `render-post.mjs:90` (atualmente 250ms).

### Símbolo D não aparece no PNG

Confere se `_assets/symbol-d.svg` existe e o template referencia `../_assets/symbol-d.svg` (relativo ao arquivo do template).

### Texto cortado no PNG

Provavelmente o conteúdo do YAML é muito longo pra altura disponível no template. Reduza o texto ou ajuste o template (escolha tipográfica).

### Como adicionar um template novo

1. Cria `templates/<novo-formato>.html` seguindo a convenção (link tokens.css + classe `.canvas` + elementos com `data-edit`)
2. Cria YAML em `posts/` com `template: <novo-formato>`
3. Renderiza: `npm run post -- --pauta posts/<arquivo>.yaml`

Não precisa tocar no `render-post.mjs` — ele é genérico.

---

## Próximo bloco

Aprovação do Bloco 4 destrava o **Bloco 5 — Operação e Medição**:

- Workflow semanal (briefing → copy → render → review → agenda)
- Ferramenta de agendamento recomendada (Metricool ou Postgrain — nativos pra IG BR)
- Dashboard de KPIs com as metas dos 90 dias (saves/1k, DMs qualificadas, cliques link bio)
- Checklist de publicação (validação anti-troca-nome, anti-coach, anti-emoji-proibido)
- Ciclo de revisão mensal (M1 → recalibragem → M2)

---

## ✅ Checklist de aprovação

- [ ] Setup (`npm install` em `marketing/instagram/`) roda sem erro
- [ ] `npm run post -- --pauta posts/2026-05-04_funil_01-capa.yaml` gera PNG correto
- [ ] PNG da capa tem dimensão 1080×1350 e símbolo D no canto
- [ ] PNG do reel tem dimensão 1080×1920
- [ ] `npm run posts:all` renderiza as 5 pautas em fila com sucesso
- [ ] Convenção do YAML é fácil de escrever (template + data)
- [ ] Convenção `data-edit` aceita HTML inline (br, span class)

> Roda os comandos, abre os PNGs gerados em `marketing/instagram/output/` e diz se tá tudo certo. Se precisar ajustar template/conteúdo, posso refazer antes do Bloco 5.
