# Investigação Backend × Extensão Chrome — Relatório

**Data:** 2026-04-23
**Branch:** main (último commit: `da3a2eb merge: feature/extension-mvp into main`)
**Escopo:** Mapear o que o backend TriboCRM (Node + Express + Prisma) já oferece para a extensão Chrome consumir.
**Modo:** READ-ONLY. Nenhum arquivo alterado.

---

## A) Mapeamento de endpoints existentes

Rotas declaradas em `src/routes/*.ts` e consumidas pela extensão (omiti rotas de pagamento, admin, webhooks, oauth, tenants, automations, campaigns — fora do escopo).

### A.1) Autenticação (`/auth`)

| Método | Path | Arquivo:linha | Auth | Controller/handler |
|---|---|---|---|---|
| POST | `/auth/login` | `routes/auth.routes.ts:9` | público | `auth.controller.login` |
| POST | `/auth/refresh` | `routes/auth.routes.ts:10` | cookie `refreshToken` | `auth.controller.refresh` |
| POST | `/auth/logout` | `routes/auth.routes.ts:11` | cookie | `auth.controller.logout` |
| GET  | `/auth/me` | `routes/auth.routes.ts:20` | JWT | inline handler |
| POST | `/auth/change-password` | `routes/auth.routes.ts:83` | JWT | inline handler |

### A.2) Leads (`/leads`)

Todo o router aplica `authMiddleware` + `tenantStatusGuard` (`leads.routes.ts:13-14`).

| Método | Path | Arquivo:linha | Auth | Handler |
|---|---|---|---|---|
| GET    | `/leads/import/template` | `leads.routes.ts:32` | JWT+tenantGuard | `getImportTemplate` |
| POST   | `/leads/import` | `leads.routes.ts:33` | JWT+tenantGuard | `importLeads` |
| GET    | `/leads/export` | `leads.routes.ts:34` | JWT+tenantGuard | `exportLeads` |
| GET    | `/leads/loss-reasons` | `leads.routes.ts:35` | JWT+tenantGuard | `getLossReasons` |
| PATCH  | `/leads/bulk` | `leads.routes.ts:36` | JWT+tenantGuard | `bulkUpdateLeads` |
| GET    | `/leads` | `leads.routes.ts:38` | JWT+tenantGuard | `getLeads` (paginado, aceita `search`) |
| GET    | `/leads/:id` | `leads.routes.ts:39` | JWT+tenantGuard | `getLead` |
| POST   | `/leads` | `leads.routes.ts:40` | JWT+tenantGuard | `createLead` |
| PATCH  | `/leads/:id` | `leads.routes.ts:41` | JWT+tenantGuard | `updateLead` (aceita `stageId`, `status`, etc.) |
| DELETE | `/leads/:id` | `leads.routes.ts:42` | JWT+tenantGuard | `deleteLead` (soft delete) |
| GET    | `/leads/:id/interactions` | `leads.routes.ts:46` | JWT+tenantGuard | inline |
| POST   | `/leads/:id/interactions` | `leads.routes.ts:66` | JWT+tenantGuard | inline |
| GET    | `/leads/:id/purchases` | `leads.routes.ts:96` | JWT+tenantGuard | inline |

### A.3) Pipelines (`/pipelines`)

Router aplica `authMiddleware` + `tenantStatusGuard`.

| Método | Path | Arquivo:linha | Auth | Handler |
|---|---|---|---|---|
| GET   | `/pipelines` | `pipeline.routes.ts:12` | JWT+guard | `getPipelines` |
| GET   | `/pipelines/:id/kanban` | `pipeline.routes.ts:13` | JWT+guard | `getKanban` |
| POST  | `/pipelines` | `pipeline.routes.ts:14` | JWT+guard | `createPipeline` |
| PATCH | `/pipelines/:id` | `pipeline.routes.ts:15` | JWT+guard | `updatePipeline` |
| PUT   | `/pipelines/:pipelineId/stages` | `pipeline.routes.ts:37` | JWT+guard | inline bulk |
| PATCH | `/pipelines/:pipelineId/stages/:stageId` | `pipeline.routes.ts:182` | JWT+guard | inline rename |

**Não há** endpoint separado `GET /pipelines/:id/stages` — as stages vêm embutidas no `GET /pipelines` e no `GET /pipelines/:id/kanban`.

### A.4) Produtos (`/products`)

| Método | Path | Arquivo:linha | Auth | Handler |
|---|---|---|---|---|
| GET    | `/products` | `products.routes.ts:15` | JWT+guard | `getProducts` (aceita `search`, `isActive`) |
| POST   | `/products` | `products.routes.ts:16` | JWT+guard | `createProduct` |
| PATCH  | `/products/:id` | `products.routes.ts:17` | JWT+guard | `updateProduct` |
| DELETE | `/products/:id` | `products.routes.ts:18` | JWT+guard | `deleteProduct` (soft) |
| GET    | `/products/discount-requests` | `products.routes.ts:21` | JWT+guard | `getDiscountRequests` |
| POST   | `/products/discount-requests` | `products.routes.ts:22` | JWT+guard | `createDiscountRequest` |
| PATCH  | `/products/discount-requests/:id/review` | `products.routes.ts:23` | JWT+guard | `reviewDiscountRequest` |

**Não há** endpoint para associar produto a lead (não existe `POST /leads/:id/products`). O modelo `LeadProduct` existe no schema (`prisma/schema.prisma:640`) mas **não há rota Express** que leia/escreva esta tabela.

### A.5) Outros consumidos pela extensão

| Método | Path | Arquivo:linha | Auth | Handler |
|---|---|---|---|---|
| GET  | `/users` | `users.routes.ts:60` | JWT+guard | `getUsers` |
| PATCH| `/users/me` | `users.routes.ts:19` | JWT+guard | inline avatar |
| GET  | `/tenants/me` | `tenants.routes.ts:111` | JWT | inline |
| PATCH| `/tenants/me` | `tenants.routes.ts:171` | JWT | inline |
| GET  | `/health` | `app.ts:73` | público | inline |

---

## B) Tabela de lacunas — o que a extensão precisa × o que existe

### B.1) Autenticação

| Funcionalidade | Endpoint esperado | Status | Observação |
|---|---|---|---|
| Login email+senha → JWT | `POST /auth/login` | ✅ Existe | Retorna `{ accessToken, user }` e seta cookie httpOnly `refreshToken`. Extensão provavelmente não consegue usar cookie httpOnly cross-origin — ver F. |
| Refresh de token | `POST /auth/refresh` | ⚠️ Ajuste | Aceita refresh via cookie **ou** `req.body.refreshToken`. Extensão deve mandar no body pois cookies httpOnly não fluem pra `chrome-extension://`. |
| Dados do usuário logado | `GET /auth/me` | ✅ Existe | Retorna `{ user, tenant, plan }`. |
| Logout | `POST /auth/logout` | ✅ Existe | Limpa cookie; se extensão não usa cookie, pode simplesmente descartar o token localmente. |

### B.2) Leads

| Funcionalidade | Endpoint esperado | Status | Observação |
|---|---|---|---|
| Buscar lead por telefone | `GET /leads/by-phone/:phone` | ❌ **Falta** | Não existe rota dedicada. Workaround: `GET /leads?search=<phone>` — **porém** `search` hoje só faz match em `name`, `company`, `email` (`leads.controller.ts:118-122`), **não em phone/whatsapp**. Precisa criar endpoint OU estender o `search` do `getLeads`. |
| Buscar lead por ID | `GET /leads/:id` | ✅ Existe | Retorna lead com `stage`, `responsible`, `interactions` (20), `tasks` não concluídas. |
| Autocomplete por nome/empresa | `GET /leads/search?q=&limit=10` | ⚠️ Ajuste | Funcionalmente `GET /leads?search=X&perPage=10` cobre, mas a assinatura é diferente (usa `search` e `perPage`, não `q` e `limit`). Extensão precisa adaptar o shape OU criar um endpoint dedicado mais leve. |
| Criar lead | `POST /leads` | ⚠️ Ajuste | Obriga `pipelineId` e `stageId` no body (`leads.controller.ts:294`). A extensão precisa conhecer o pipeline default + primeira stage antes de criar — ou o endpoint precisa virar "smart" e inferir. |
| Atualizar etapa | `PATCH /leads/:id/stage` | ⚠️ Ajuste | Não existe rota dedicada. Use `PATCH /leads/:id` com `{ stageId }` — cobre o caso. Para "marcar Vendido/Perdido", `PATCH /leads/:id` também aceita `status`, `closedValue`, `wonAt`, `lostAt`, `lossReasonId`. |

### B.3) Pipelines e Etapas

| Funcionalidade | Endpoint esperado | Status | Observação |
|---|---|---|---|
| Listar pipelines | `GET /pipelines` | ✅ Existe | Já inclui `stages` ordenadas por `sortOrder`. |
| Listar etapas de pipeline | `GET /pipelines/:id/stages` | ⚠️ Ajuste | Não há endpoint dedicado. Usa-se o `stages` aninhado no `GET /pipelines` (ou no `getKanban`). |
| Identificar etapa "Vendido"/"Perdido" | por `type` = WON/LOST | ✅ Existe | Campo `type: StageType` com valores `NORMAL, WON, LOST, REACTIVATION` (`schema.prisma:71-76`). O `getKanban` já devolve `type` por stage. O `getPipelines` inclui o objeto stage inteiro — `type` está lá (Prisma retorna todos os campos por padrão). |

### B.4) Interações

| Funcionalidade | Endpoint esperado | Status | Observação |
|---|---|---|---|
| Listar interações de lead | `GET /leads/:id/interactions` | ✅ Existe | `leads.routes.ts:46`. Retorna 30 mais recentes, aliases `content ↔ description`. |
| Criar interação | `POST /leads/:id/interactions` | ✅ Existe | `leads.routes.ts:66`. Aceita `type`, `content/description/notes`. `type` deve ser enum: `CALL, EMAIL, MEETING, WHATSAPP, PROPOSAL, VISIT, NOTE, SYSTEM` (`schema.prisma:85-94`). |

### B.5) Produtos

| Funcionalidade | Endpoint esperado | Status | Observação |
|---|---|---|---|
| Listar catálogo | `GET /products` | ✅ Existe | Aceita `search`, `isActive`. |
| Associar produtos a lead (com qty + preço) | `POST /leads/:id/products` | ❌ **Falta** | Model `LeadProduct` existe mas **nenhuma rota** o expõe. Precisa criar CRUD completo. |

### B.6) Outros

| Funcionalidade | Endpoint esperado | Status | Observação |
|---|---|---|---|
| Motivos de perda do tenant | `GET /leads/loss-reasons` | ✅ Existe | `leads.routes.ts:35`. Retorna `{ id, name }` ativos ordenados por `sortOrder`. |

---

## C) Shape dos dados (endpoints que existem)

Convenção: **todas** as respostas seguem `{ success: boolean, data: T, error?: {...}, meta?: {...} }`.

### C.1) `POST /auth/login` (200)

```ts
{
  success: true,
  data: {
    accessToken: string,   // JWT, expires 8h
    user: {
      id: string,
      name: string,
      email: string,
      role: 'OWNER' | 'MANAGER' | 'TEAM_LEADER' | 'SELLER',  // ou 'SUPER_ADMIN' em admin_users
      tenantId: string,
      avatarUrl: string | null,
      themePreference: 'DARK' | 'LIGHT',
      tenantName: string,
      emailVerified: boolean,
      onboardingCompleted: boolean,
      onboardingStep: number,
    }
  }
}
```

Também seta cookie httpOnly `refreshToken` (30d).

### C.2) `GET /auth/me`

```ts
{
  success: true,
  data: {
    user: { id, name, email, role, tenantId, avatarUrl },
    tenant: {
      id, name, tradeName, status,
      planCycle, trialEndsAt, planExpiresAt, planStartedAt,
      lastBillingState, lastBillingStateAt
    } | null,   // null para SUPER_ADMIN
    plan: { id, slug, name, priceMonthly, priceYearly } | null
  }
}
```

### C.3) `GET /leads/:id`

Retorna `Lead` completo do Prisma + relações:

```ts
{
  success: true,
  data: {
    id: string,
    tenantId: string,
    pipelineId: string,
    stageId: string,
    responsibleId: string,
    teamId: string | null,
    createdBy: string,
    name: string,
    email: string | null,
    phone: string | null,
    whatsapp: string | null,
    cpf: string | null,
    cnpj: string | null,
    company: string | null,
    position: string | null,
    source: string | null,
    temperature: 'HOT' | 'WARM' | 'COLD',
    expectedValue: string | null,   // Decimal serializado
    closedValue: string | null,
    lossReasonId: string | null,
    status: 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED',
    wonAt: string | null, lostAt: string | null,
    lastActivityAt: string | null,
    notes: string | null,
    customFields: object | null,
    createdAt: string, updatedAt: string, deletedAt: string | null,
    stage: { id, name, color },          // tipo NÃO incluído aqui (apenas id/name/color)
    responsible: { id, name },
    interactions: Array<{
      id, tenantId, leadId, userId,
      type: InteractionType,
      content: string,
      description: string,               // alias de content
      occurredAt, isAuto, createdAt
    }>,
    tasks: Task[]                         // só não concluídas
  }
}
```

> ⚠️ `stage` em `getLead` **não inclui** `type` (só `id, name, color`). Para saber se é WON/LOST, chamar `GET /pipelines` separadamente, OU o endpoint precisa ser estendido.

### C.4) `GET /leads` (lista paginada)

Query params: `pipelineId, stageId, status, temperature, responsibleId, search, page, perPage` (padrão 1 / 20, cap 100).

```ts
{
  success: true,
  data: Array<Lead & {
    stage: { id, name, color },
    responsible: { id, name }
  }>,
  meta: { total, page, perPage, totalPages }
}
```

> `search` cobre `name`, `company`, `email` — **não** `phone/whatsapp`.
> SELLER: `where.responsibleId = req.user.userId` é forçado (ver F).

### C.5) `GET /pipelines`

```ts
{
  success: true,
  data: Array<{
    id, tenantId, name,
    isDefault: boolean,
    distributionType: 'MANUAL' | 'ROUND_ROBIN_ALL' | 'ROUND_ROBIN_TEAM' | 'SPECIFIC_USER',
    lastAssignedUserId: string | null,
    teamId: string | null, specificUserId: string | null,
    isActive: boolean, createdAt,
    stages: Array<{
      id, tenantId, pipelineId,
      name, color, sortOrder,
      type: 'NORMAL' | 'WON' | 'LOST' | 'REACTIVATION',
      isFixed: boolean, isActive: boolean,
      createdAt
    }>
  }>
}
```

### C.6) `GET /pipelines/:id/kanban`

```ts
{
  success: true,
  data: {
    pipeline: { id, name },
    stages: Array<{
      id, name, color, type, position,
      leads: Array<{ id, name, company, email, phone, whatsapp,
        expectedValue, closedValue, wonAt, createdAt,
        temperature, status, stageId, lastActivityAt,
        responsible: { id, name } }>
    }>
  }
}
```

### C.7) `GET /leads/:id/interactions`

```ts
{
  success: true,
  data: Array<{
    id, tenantId, leadId, userId,
    type: 'CALL'|'EMAIL'|'MEETING'|'WHATSAPP'|'PROPOSAL'|'VISIT'|'NOTE'|'SYSTEM',
    content: string,
    description: string,   // alias
    occurredAt, isAuto, createdAt,
    user: { id, name }
  }>
}
```

`POST /leads/:id/interactions` aceita `{ type, content|description|notes }` e retorna a interação criada.

### C.8) `GET /products`

```ts
{
  success: true,
  data: Array<{
    id, tenantId, name, description, category,
    price: Decimal, allowsDiscount: boolean,
    discountType: 'PERCENTAGE' | 'FIXED' | null,
    maxDiscount: Decimal | null,
    approvalType: 'PASSWORD' | 'MANAGER_REVIEW' | null,
    isActive, createdAt
  }>
}
```

### C.9) `GET /leads/loss-reasons`

```ts
{ success: true, data: Array<{ id: string, name: string }> }
```

---

## D) CORS

**Arquivo:** `src/app.ts:33-51`.

- **Lib:** `cors` (npm) aplicada globalmente via `app.use(cors({...}))`.
- **Função origin dinâmica:**
  ```ts
  const allowed = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://tribocrm.vercel.app',
    'https://tribocrm.com.br',
    'https://www.tribocrm.com.br',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ]
  if (!origin || allowed.includes(origin)) callback(null, true)
  else callback(new Error('Not allowed by CORS'))
  ```
- **`credentials: true`** — suporta envio de cookies.
- **OPTIONS:** tratado automaticamente pelo middleware `cors` (preflight automático).

### ⚠️ Bloqueio crítico

**`chrome-extension://<id>`** **NÃO** está na whitelist. O middleware vai rejeitar qualquer `fetch` vindo da extensão com o cabeçalho `Origin: chrome-extension://...`.

**Exceção:** requisições **sem** `Origin` (ex.: background service workers em alguns casos usando fetch com `mode: 'no-cors'` ou `omit`) passam pela condição `if (!origin || ...)`. Mas, em geral, o Chrome envia `Origin: chrome-extension://<id>` em fetches de content scripts e do popup.

> A rota `/public` (`public.routes.ts:15-21`) tem CORS próprio com `origin: true` (reflete qualquer origem). Mas ela expõe só os endpoints de formulário embed — não serve para a extensão.

---

## E) Autenticação e middlewares

### E.1) `authMiddleware` (`src/middleware/auth.middleware.ts`)

- Lê token de `Authorization: Bearer <token>` **ou** do query param `?token=`.
- Valida com `JWT_SECRET` (erro → 401 `TOKEN_INVALID`).
- **Gate de e-mail verificado:** usuários não-SUPER_ADMIN precisam ter `emailVerified=true` no banco — retorna 403 `EMAIL_NOT_VERIFIED` caso contrário. Cache de 60s.
- **Anexa em `req.user`:**
  ```ts
  {
    userId: string,
    tenantId: string,        // pode ser swap de linkedTenantId para super admin dual-access
    role: string,
    teamId: string | null,
    linkedTenantId: string | null
  }
  ```
- **Payload do JWT:** `{ userId, tenantId, role, teamId, linkedTenantId? }`.
- `tenantId` vem do **JWT claim** — não há header/query separada para tenant.

### E.2) `tenantStatusGuard` (`src/middleware/tenant-status.middleware.ts`)

- Aplicado em **praticamente todos os routers** relevantes para a extensão: `leads`, `pipelines`, `products`, `users`, `tasks`, `notifications`, `reports`, `goals`, `templates`, `forms`, `automations`, `email/send`, `oauth/*/authorize`.
- **Não aplicado em `/auth/*`** (apenas `/auth/me` tem só `authMiddleware`).
- Bloqueia requests se `tenant.status === 'SUSPENDED'` → 403 `TENANT_SUSPENDED`.
- Bloqueia requests se `tenant.status === 'CANCELLED'` → 403 `TENANT_CANCELLED`.
- Cache in-memory de 30s do status.
- **Impacto para extensão:** se o tenant do usuário da extensão estiver suspenso/cancelado, 100% das chamadas de leads/interactions/produtos falham com 403.

### E.3) Rate limiting

`app.ts:54-65` — `express-rate-limit`:
- 100 req / 15 min por IP.
- Headers: `RateLimit-*` (standard).
- Ignorado para `/webhooks*`.
- **Impacto para extensão:** usuário ativo abrindo várias conversas pode estourar. Limite fica curto para a aparência da extensão ("ligação detectada, busca lead, abre drawer" × N contatos). Considerar whitelist por token.

---

## F) Isolamento por role (SELLER)

### F.1) Filtro SELLER aplicado — onde funciona

Grep por `role === 'SELLER'` localizou isolamento **apenas nestes pontos**:

- `leads.controller.ts:111` — `getLeads` (listagem) força `where.responsibleId = userId` para SELLER. ✅
- `leads.controller.ts:1027` — `exportLeads` faz o mesmo. ✅
- `tasks.controller.ts:28` — `getTasks` faz o mesmo. ✅

### F.2) Gap de isolamento — `GET /leads/:id`

**`getLead` (`leads.controller.ts:160-203`) NÃO filtra por `responsibleId`.** Busca apenas por `id + tenantId + deletedAt: null`:

```ts
const lead = await prisma.lead.findFirst({
  where: { id, tenantId, deletedAt: null },
  ...
})
```

Consequência: **um SELLER consegue acessar qualquer lead do tenant pelo id, desde que saiba o UUID.** A lista só mostra os próprios, mas a rota de detalhe é aberta dentro do tenant. Pode ser intencional (UI gestor passa pelo mesmo endpoint) ou gap de segurança — investigar antes de expor à extensão.

### F.3) Gap — `updateLead`, `deleteLead`, `/:id/interactions`, `/:id/purchases`

Mesmo padrão: filtram apenas por `tenantId`. Um SELLER pode, teoricamente, editar qualquer lead do tenant via API direta.

### F.4) Lógica de permissão admin/manager

Não existe um middleware "role ≥ X" centralizado para vendas. Algumas rotas fazem check manual (ex.: `reviewDiscountRequest` em `products.controller.ts:291` exige MANAGER/OWNER). O filtro SELLER-only-own-leads **existe só no `getLeads/exportLeads`** — demais endpoints de leitura/escrita em leads não restringem por responsável.

---

## G) Dados de catálogo / seed

Arquivo `src/seed.ts`:

| Item | Presente no seed? | Detalhe |
|---|---|---|
| Planos (Free, Solo, Essencial, Pro, Enterprise) | ✅ | upsert por `slug`. |
| Super admin | ✅ | `admin@tribocrm.com.br` senha `Admin@2026`. |
| Tenant "Tribo de Vendas" | ⚠️ parcial | Criado com CNPJ **`00.000.000/0001-00`** no seed, **não** `32285015000130` como mencionado no briefing. Plano: Pro. |
| Usuário `lucas@tribodevendas.com.br` | ✅ | Role OWNER, senha `Admin@2026`. |
| Produtos de catálogo padrão | ❌ | Seed **não** cria produtos de exemplo. Product table provavelmente vazia para este tenant a menos que haja seed manual posterior. |
| Pipeline padrão com etapas | ❌ | Seed **não** cria pipeline. `DEFAULT_STAGES` existe em `pipeline.controller.ts:104-112` e é criado quando `POST /pipelines` é chamado pela primeira vez pelo tenant. Etapas default: Sem Contato → Em Contato → Negociando → Proposta Enviada → **Venda Realizada (WON, fixed)** → Repescagem → **Perdido (LOST, fixed)**. |
| Loss reasons default | ❌ | Seed não cria. Fluxo de onboarding/código não-identificado provavelmente cria, ou o endpoint `/leads/loss-reasons` devolve `[]`. |

> **Importante:** o CNPJ do briefing (`32285015000130`) diverge do CNPJ no seed. Se produção já tem dados reais com outro CNPJ, verificar qual é o registro vivo — pode haver dois tenants "Tribo de Vendas" dependendo de criação via signup vs. seed.

---

## H) Variáveis de ambiente e URLs

### `.env.example` (`backend/.env.example`)

- `DATABASE_URL`, `DIRECT_URL` — Supabase Postgres.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`.
- `NODE_ENV=production`, `PORT=3002`.
- `FRONTEND_URL=https://tribocrm.vercel.app` (usado no CORS como primeiro allowed).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- `EFI_*` (pagamentos).
- `SMTP_*` (opcional).
- `SUPABASE_*` (opcional).

### URLs identificadas

| Ambiente | URL da API | Evidência |
|---|---|---|
| **Produção (esperada)** | `https://api.tribocrm.com.br` | `.env.example:29` (`EFI_WEBHOOK_URL` exemplo), `src/public/embed.js:5` (docstring) |
| **Produção (Railway real)** | `https://tribocrm-production.up.railway.app` | `services/googleOAuth.service.ts:12-13`, `services/gmail.service.ts:4`, `services/efi.service.ts:224,541`, `routes/oauth.routes.ts:13-14` |
| **Staging/Dev** | Não identifiquei URL dedicada | Só local (`localhost:3001/3002`) no CORS |
| **Frontend prod** | `https://tribocrm.vercel.app` e `https://app.tribocrm.com.br` | `services/mailer`, `controllers/password.controller.ts:50`, `controllers/signup.controller.ts:264,585` |
| **Site marketing** | `https://tribocrm.com.br` / `https://www.tribocrm.com.br` | CORS whitelist |

**Ambiguidade:** o código tem hard-coded fallbacks para `tribocrm-production.up.railway.app` (Railway), mas `.env.example` sugere `api.tribocrm.com.br` como domínio custom. Provavelmente Railway está por trás do `api.tribocrm.com.br` via proxy/CNAME — **verificar com o usuário**.

---

## RESUMO EXECUTIVO

### Números

1. **Endpoints que EXISTEM e atendem prontos:** **10**
   - `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
   - `GET /leads/:id`, `POST /leads` (com caveats de campos obrigatórios)
   - `GET /pipelines`, `GET /leads/:id/interactions`, `POST /leads/:id/interactions`
   - `GET /products`, `GET /leads/loss-reasons`

2. **Endpoints que PRECISAM AJUSTE:** **4**
   - `POST /auth/refresh` — extensão precisa enviar refresh via body (cookie httpOnly não funciona cross-origin da extensão).
   - Autocomplete/search de leads — usar `GET /leads?search=X&perPage=10` (shape difere do esperado `/leads/search?q=&limit=`).
   - `GET /leads/:id` — response **não inclui `stage.type`** (só id/name/color); precisa ou (a) cruzar com `/pipelines`, ou (b) estender o select da controller.
   - `POST /leads` — exige `pipelineId` e `stageId` no body; extensão precisa buscar pipeline default antes.

3. **Endpoints que PRECISAM SER CRIADOS do zero:** **2**
   - `GET /leads/by-phone/:phone` — ou estender `search` do `getLeads` para incluir `phone` e `whatsapp`.
   - `POST /leads/:id/products` (+ GET/PATCH/DELETE) — associação LeadProduct não tem rota; o model existe mas está órfão.

### Bloqueios críticos para a extensão funcionar

1. **🔴 CORS não libera `chrome-extension://`** (`app.ts:33-51`). Toda requisição da extensão com `Origin` setado é **rejeitada**. Fix: adicionar `chrome-extension://<ID>` na whitelist, ou usar função `origin` que aceite esse protocolo.

2. **🔴 Refresh token via cookie httpOnly** não chega da extensão (origem `chrome-extension://` não recebe cookies do domínio `api.tribocrm.com.br` normalmente, e mesmo com `credentials: 'include'` o Chrome bloqueia cross-site cookies na extensão). O endpoint `/auth/refresh` já aceita `req.body.refreshToken` — só precisa a extensão armazenar o refresh e enviá-lo no body.

3. **🟡 Gate de `emailVerified`** (`auth.middleware.ts:78-96`). Se o usuário da extensão não tem email verificado, todas as chamadas retornam 403. Verificar se usuários legados/seed têm essa flag setada.

4. **🟡 `tenantStatusGuard` global** em `/leads`, `/pipelines`, `/products`. Tenant suspenso → extensão totalmente quebrada. Isso é intencional mas precisa UX na extensão (tela "sua conta está suspensa").

5. **🟡 Rate limit 100 req / 15 min** por IP. Se múltiplos usuários atrás do mesmo NAT usarem a extensão, pode estourar rápido. Considerar trocar `keyGenerator` para `req.user?.userId` em rotas autenticadas.

6. **🟡 Gap de segurança no isolamento SELLER** — `getLead`, `updateLead`, `deleteLead`, `/:id/interactions`, `/:id/purchases` **não filtram** por `responsibleId`. SELLER acessa qualquer lead do tenant pelo UUID. Se a extensão for exclusivamente SELLER, convém decidir se quer endurecer isso antes (pode ser feito com middleware ou no próprio `findFirst`).

### Recomendação de ordem de implementação

1. **Desbloquear CORS para a extensão** — mudar `app.ts` para aceitar `chrome-extension://<ID>` (usar o ID publicado na Chrome Web Store; ou, em dev, aceitar qualquer `chrome-extension://*`).
2. **Ajustar armazenamento de refresh na extensão** — guardar em `chrome.storage.local` e mandar via body no `POST /auth/refresh`.
3. **Adicionar `phone`/`whatsapp` ao `search` do `getLeads`** — 5 linhas em `leads.controller.ts:117-123`. Evita ter que criar `/leads/by-phone/:phone` separado. Se quiser ser estrito, criar a rota nova também.
4. **Incluir `type` no `stage` do `getLead`** — mudar o `select` em `leads.controller.ts:168` para `{ id, name, color, type }`. Extensão precisa pra saber se já está em WON/LOST.
5. **Criar rotas LeadProduct** — `GET/POST/PATCH/DELETE /leads/:id/products`. Infra de dados (model) já existe.
6. **Endurecer filtro SELLER em `getLead`/`updateLead`** — opcional, mas recomendado antes de a extensão expor mais ações sobre leads alheios.
7. **Whitelist de rate limit para requests autenticadas** — opcional, monitorar primeiro.
8. **Validar dados de seed em produção** — CNPJ correto do tenant, pipeline default criado, loss reasons, produtos de catálogo.

### Caminho do relatório

`C:\Users\Doctum\tribocrm\backend\INVESTIGACAO_BACKEND_EXTENSAO.md`
