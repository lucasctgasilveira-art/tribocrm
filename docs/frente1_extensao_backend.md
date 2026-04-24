# Frente 1 — Integração Backend ↔ Extensão Chrome

## Contexto

A extensão Chrome do TriboCRM foi publicada na Chrome Web Store
(ID: `pgfegmelobfejcgccmdofmpljidffpga`) e até então rodava com mocks no
client-side. A Frente 1 destravou a integração real com o backend de
produção, cobrindo:

- liberação de CORS pra origem `chrome-extension://`,
- ajustes de payload no `getLead`/`getLeads` consumidos pela extensão,
- hardening de autorização do papel SELLER (lacunas P0 e P1),
- CRUD de produtos por lead (necessário pra fluxo de fechamento),
- fixtures de seed pra testar a extensão localmente,
- reformas de infra (migrations no deploy, drift schema, keep-alive).

Período de execução: abril de 2026.

---

## Escopo executado

### Tarefa 1 — CORS pra `chrome-extension://`

**Contexto:** o middleware CORS do backend bloqueava requisições vindas da
extensão publicada (origem `chrome-extension://pgfegmelobfejcgccmdofmpljidffpga`),
respondendo 403 no preflight `OPTIONS`.

**Fix:** origem adicionada no whitelist em `backend/src/app.ts`.

**SHA:** `e0b492d` (main)

**Validação:** preflight `OPTIONS` retorna `Access-Control-Allow-Origin`
ecoando a origem da extensão; `GET /leads` da extensão passa a responder
200 com payload normal.

---

### Tarefa 2 — `stage.type` no `getLead`

**Contexto:** a extensão renderiza badge WON / LOST / OPEN no header do
lead, mas o `select` do Prisma no `getLead` não estava devolvendo
`stage.type` — só `stage.name`.

**Fix:** +1 campo no `select` do Prisma em `getLead`.

**SHA:** `03bf64c` (main)

---

### Tarefa 3 — `phone` e `whatsapp` no search de leads

**Contexto:** a extensão busca lead pelo número do WhatsApp (caso de uso
principal: o vendedor abre o WhatsApp Web, a extensão detecta o número e
puxa o lead correspondente). O `where.OR` do `getLeads` só procurava em
`name` e `email`.

**Fix:** +2 linhas no `where.OR` cobrindo `phone` e `whatsapp` com
`contains` case-insensitive.

**SHA:** `6133346` (main)

---

### Tarefa 4 — SELLER hardening (CRÍTICA de segurança)

**Contexto:** o papel SELLER conseguia acessar leads de outros SELLERs do
mesmo tenant via UUID direto na URL — vazamento horizontal entre
vendedores. Não havia checagem de ownership nas rotas de detalhe.

**P0 — leitura/escrita individual de lead** (`b6bda38`)

- `getLead`: 404 NOT_FOUND ao acessar lead alheio (escolha deliberada de
  esconder existência em vez de retornar 403)
- `updateLead`: idem
- `deleteLead`: idem
- `interactions` (GET/POST): idem

**P1 — operações em lote e adjacentes** (`703bcf3`)

- `createLead`: se o caller for SELLER, `responsibleId` é forçado a
  `userId` (não pode criar lead atribuído a outro vendedor)
- `bulkUpdate`: 403 FORBIDDEN pra SELLER (operação restrita a OWNER/ADMIN)
- `purchases`: ownership aplicado nos endpoints relacionados

**Helper introduzido:** `sellerScope(role, userId)` em
`backend/src/controllers/leads.controller.ts` — devolve um filtro Prisma
adicional (`{ responsibleId: userId }` se SELLER, `{}` caso contrário) que
é mesclado no `where`. Centraliza a regra e evita duplicação.

**Status codes adotados:**

| Cenário | Code | Motivo |
|---|---|---|
| SELLER acessa lead alheio | 404 | esconde existência (evita enumeração de UUIDs) |
| SELLER chama bulkUpdate | 403 | gestão é OWNER/ADMIN-only |
| SELLER cria lead com responsibleId ≠ userId | (silencioso) | sobrescrito server-side |

---

### Tarefa 5 — CRUD `/leads/:id/products`

**Contexto:** a extensão precisa gerenciar os produtos vinculados ao lead
(itens da proposta) — adicionar, remover, ajustar quantidade e desconto.
Não havia endpoint público pra isso.

**Adicionados** (inline em `backend/src/routes/leads.routes.ts`):

- `GET /leads/:id/products` — lista produtos do lead
- `POST /leads/:id/products` — adiciona produto; **409 CONFLICT** se já
  existe item com mesmo `productId` no lead (sem dedup automático)
- `PATCH /leads/:id/products/:itemId` — altera quantidade/desconto/preço
- `DELETE /leads/:id/products/:itemId` — remove item

**Regras de negócio:**

- desconto é validado contra `product.maxDiscount` (rejeita se ultrapassa)
- `finalPrice` é calculado server-side a partir de
  `unitPrice × quantity × (1 - discount)` — client-side não controla esse
  campo
- `sellerScope(role, userId)` aplicado em todos os 4 endpoints (SELLER só
  mexe em produtos dos próprios leads)

**SHA:** `ba681a9` (main)

---

### Tarefa 6 — Seed investigation + fixtures de extensão

**Contexto:** a investigação inicial (read-only) descobriu que existia um
seed mínimo (`db:seed`) mas faltavam dados representativos pra testar o
fluxo da extensão de ponta a ponta — leads com produtos, interactions,
stages variados.

**Resultado:** fixtures opcionais implementadas, ativadas por env var:

```bash
SEED_EXTENSION_FIXTURES=1 npm run db:seed
```

Quando ativada, o seed insere leads com payload representativo do que a
extensão consome (telefones brasileiros, stages mistos, produtos
vinculados). Sem a env var, o comportamento default é preservado.

**Bônus:** o `package.json` tinha `db:seed` apontando pra um path errado
— corrigido junto.

**SHA:** `7b1ff33` (main)

---

## Infraestrutura reformada na frente

| Área | Mudança | SHA(s) main |
|---|---|---|
| Deploy | `prisma migrate deploy` adicionado ao start command em `railway.json` | `af7c39b` (+ reapplies) |
| Drift schema | 19 colunas + 4 tabelas reconciliadas entre `schema.prisma` e migrations | `25efab5`, `22719aa` |
| Staging recovery | `DROP SCHEMA` + `pg_dump` de produção + tabela `_prisma_migrations` reparada (manual no Supabase) | — |
| Keep-alive | GitHub Actions cron a cada 5 dias pingando `/health` pra evitar pausa do Supabase Free | `4e68982` |

---

## Backlog técnico (não fechado nesta frente)

- **Senha admin fraca em produção** (`Teste@123`) — precisa rotação
- **Rotacionar senha Supabase produção** — mesma senha em uso desde o setup
- **Plano A (drift recovery definitivo)** — adiada até receita justificar
  o downtime/risco

---

## Credenciais staging (pra testar extensão)

- **URL backend:** https://tribocrm-production-07bc.up.railway.app
- **OWNER:** `lucas@tribodevendas.com.br` / `Admin@2026`
- **SELLER:** `ana@tribodevendas.com.br` / `Teste@123`
- **SELLER:** `bruno@tribodevendas.com.br` / `Teste@123`

---

## Referências

- Branch `main` → produção (api.tribocrm.com.br)
- Branch `develop` → staging (tribocrm-production-07bc.up.railway.app)
- Extensão na Chrome Web Store:
  https://chromewebstore.google.com/detail/tribocrm/pgfegmelobfejcgccmdofmpljidffpga
