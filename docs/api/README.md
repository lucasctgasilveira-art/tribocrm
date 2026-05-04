# API Pública TriboCRM — v1

API REST autenticada por API key. Permite que sistemas externos (formulários de captação, automações, ferramentas no-code como Zapier/Make, sistemas próprios do cliente) **criem leads e consultem dados** do CRM.

> **Status:** v1 — escopo mínimo de produção (criar lead + consultas de leads, pipelines, tarefas). Operações de atualização e exclusão ficam para v2.

---

## Sumário

- [Como obter uma API key](#como-obter-uma-api-key)
- [Autenticação](#autenticação)
- [Limites](#limites)
- [Convenções](#convenções)
- [Endpoints](#endpoints)
  - [POST `/v1/leads`](#post-v1leads----criar-lead)
  - [GET `/v1/leads`](#get-v1leads----listar-leads)
  - [GET `/v1/leads/:id`](#get-v1leadsid----buscar-lead)
  - [GET `/v1/pipelines`](#get-v1pipelines----listar-pipelines)
  - [GET `/v1/tasks`](#get-v1tasks----listar-tarefas)
- [Códigos de erro](#códigos-de-erro)

---

## Como obter uma API key

1. Entre no CRM como **OWNER** ou **MANAGER**.
2. Vá em **Configuração → API Keys**.
3. Clique em **Nova key**, dê um nome (ex.: "Site institucional", "Zapier") e clique em **Criar**.
4. **Copie a key na hora.** Ela aparece **uma única vez** — depois disso, só o prefixo (ex.: `tcrm_live_a1b2c3…`) fica visível.

> A key é como uma senha. Nunca comite em código aberto, nunca compartilhe por canais inseguros. Se vazar, revogue e crie uma nova imediatamente.

---

## Autenticação

Toda requisição precisa do header:

```
Authorization: Bearer tcrm_live_<sua key>
```

Exemplo:

```
Authorization: Bearer tcrm_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

URL base de produção: `https://api.tribocrm.com.br/v1`

---

## Limites

Aplicados **por API key**:

| Limite              | Valor      |
| ------------------- | ---------- |
| Requests por minuto | 60         |
| Requests por hora   | 1.000      |

Excedeu, retornamos **HTTP 429** com header `Retry-After: <segundos até liberar>`.

Headers de leitura em toda resposta com sucesso:

```
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 47
X-RateLimit-Limit-Hour: 1000
X-RateLimit-Remaining-Hour: 832
```

---

## Convenções

### Resposta de sucesso

```json
{
  "success": true,
  "data": { /* ... */ }
}
```

Listagens incluem `meta`:

```json
{
  "success": true,
  "data": [ /* ... */ ],
  "meta": { "total": 142, "page": 1, "limit": 50, "totalPages": 3 }
}
```

### Resposta de erro

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "name é obrigatório" }
}
```

### Datas

Todas as datas são ISO 8601 em UTC (`2026-05-04T15:30:00.000Z`).

### Paginação

Endpoints de listagem aceitam `page` (default: 1) e `limit` (default: 50, máximo: 100).

---

## Endpoints

### POST `/v1/leads` — criar lead

Cria um lead no pipeline informado (ou no pipeline padrão do tenant).

**Body** (JSON):

| Campo            | Tipo     | Obrigatório | Descrição                                                                |
| ---------------- | -------- | ----------- | ------------------------------------------------------------------------ |
| `name`           | string   | ✅           | Nome do lead.                                                            |
| `email`          | string   |             | E-mail.                                                                  |
| `phone`          | string   |             | Telefone principal.                                                      |
| `whatsapp`       | string   |             | WhatsApp (se diferente do `phone`).                                      |
| `company`        | string   |             | Empresa.                                                                 |
| `source`         | string   |             | Origem do lead. Default: `"API"`.                                        |
| `temperature`    | string   |             | `HOT`, `WARM` ou `COLD`. Default: `COLD`.                                |
| `expectedValue`  | number   |             | Valor esperado da venda.                                                 |
| `pipelineId`     | string   |             | UUID do pipeline. Default: pipeline marcado como padrão (ou primeiro).   |
| `stageId`        | string   |             | UUID da etapa. Default: primeira etapa ativa do pipeline.                |
| `responsibleId`  | string   |             | UUID do usuário responsável. Default: round-robin entre vendedores.      |

**Exemplo — `curl`:**

```bash
curl -X POST https://api.tribocrm.com.br/v1/leads \
  -H "Authorization: Bearer tcrm_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João da Silva",
    "email": "joao@empresa.com.br",
    "phone": "(31) 99999-0000",
    "company": "Empresa do João",
    "source": "Formulário do site",
    "temperature": "WARM",
    "expectedValue": 5000
  }'
```

**Resposta — 201 Created:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João da Silva",
    "email": "joao@empresa.com.br",
    "phone": "(31) 99999-0000",
    "whatsapp": null,
    "company": "Empresa do João",
    "source": "Formulário do site",
    "temperature": "WARM",
    "expectedValue": 5000,
    "closedValue": null,
    "status": "ACTIVE",
    "wonAt": null,
    "lostAt": null,
    "lastActivityAt": "2026-05-04T15:30:00.000Z",
    "createdAt": "2026-05-04T15:30:00.000Z",
    "updatedAt": "2026-05-04T15:30:00.000Z",
    "pipelineId": "...",
    "stageId": "...",
    "responsibleId": "...",
    "pipeline": { "id": "...", "name": "Vendas" },
    "stage": { "id": "...", "name": "Novo lead", "type": "NORMAL" },
    "responsible": { "id": "...", "name": "Maria Vendedora" }
  }
}
```

---

### GET `/v1/leads` — listar leads

**Query params:**

| Param            | Tipo    | Descrição                                                |
| ---------------- | ------- | -------------------------------------------------------- |
| `status`         | string  | `ACTIVE`, `WON`, `LOST` ou `ARCHIVED`.                   |
| `pipelineId`     | string  | Filtrar por pipeline.                                    |
| `stageId`        | string  | Filtrar por etapa.                                       |
| `responsibleId`  | string  | Filtrar por responsável.                                 |
| `page`           | number  | Página (default: 1).                                     |
| `limit`          | number  | Itens por página (default: 50, max: 100).                |
| `sort`           | string  | `createdAt`, `updatedAt` ou `lastActivityAt`. Default: `createdAt`. |
| `order`          | string  | `asc` ou `desc`. Default: `desc`.                        |

**Exemplo:**

```bash
curl "https://api.tribocrm.com.br/v1/leads?status=ACTIVE&limit=20" \
  -H "Authorization: Bearer tcrm_live_..."
```

---

### GET `/v1/leads/:id` — buscar lead

```bash
curl https://api.tribocrm.com.br/v1/leads/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer tcrm_live_..."
```

---

### GET `/v1/pipelines` — listar pipelines

Útil pra descobrir UUIDs de `pipelineId` e `stageId` quando precisa criar lead em um pipeline específico.

```bash
curl https://api.tribocrm.com.br/v1/pipelines \
  -H "Authorization: Bearer tcrm_live_..."
```

**Resposta:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Vendas",
      "isDefault": true,
      "stages": [
        { "id": "...", "name": "Novo lead", "type": "NORMAL", "sortOrder": 1, "color": "#3b82f6" },
        { "id": "...", "name": "Qualificação", "type": "NORMAL", "sortOrder": 2, "color": "#f97316" },
        { "id": "...", "name": "Ganho", "type": "WON", "sortOrder": 99, "color": "#22c55e" }
      ]
    }
  ]
}
```

---

### GET `/v1/tasks` — listar tarefas

**Query params:**

| Param            | Tipo    | Descrição                                       |
| ---------------- | ------- | ----------------------------------------------- |
| `responsibleId`  | string  | Filtrar por responsável.                        |
| `leadId`         | string  | Tarefas de um lead específico.                  |
| `isDone`         | string  | `true` ou `false`.                              |
| `dueBefore`      | string  | ISO date — tarefas com `dueDate <=` esse valor. |
| `dueAfter`       | string  | ISO date — tarefas com `dueDate >=` esse valor. |
| `page`, `limit`  | number  | Paginação.                                      |

```bash
curl "https://api.tribocrm.com.br/v1/tasks?isDone=false&limit=10" \
  -H "Authorization: Bearer tcrm_live_..."
```

---

## Códigos de erro

| HTTP | Código                  | Quando acontece                                                |
| ---- | ----------------------- | -------------------------------------------------------------- |
| 401  | `UNAUTHORIZED`          | Header `Authorization` ausente ou mal-formado.                 |
| 401  | `INVALID_API_KEY`       | Key não existe ou formato inválido.                            |
| 401  | `API_KEY_REVOKED`       | Key foi revogada pelo dono do CRM.                             |
| 403  | `TENANT_SUSPENDED`      | Conta do CRM suspensa por inadimplência.                       |
| 403  | `TENANT_CANCELLED`      | Conta do CRM cancelada.                                        |
| 400  | `VALIDATION_ERROR`      | Body com campo inválido ou faltando obrigatório.               |
| 404  | `NOT_FOUND`             | Recurso não encontrado.                                        |
| 404  | `PIPELINE_NOT_FOUND`    | `pipelineId` informado não existe ou não pertence ao tenant.   |
| 404  | `STAGE_NOT_FOUND`       | `stageId` não pertence ao pipeline.                            |
| 404  | `RESPONSIBLE_NOT_FOUND` | `responsibleId` informado não existe.                          |
| 409  | `NO_PIPELINE_AVAILABLE` | Tenant não tem pipeline ativo (caso raro de configuração).     |
| 409  | `NO_STAGE_AVAILABLE`    | Pipeline padrão sem etapa ativa.                               |
| 409  | `NO_USER_AVAILABLE`     | Tenant sem usuário pra atribuir o lead.                        |
| 429  | `RATE_LIMIT_MINUTE`     | Excedeu 60 req/min. Veja `Retry-After`.                        |
| 429  | `RATE_LIMIT_HOUR`       | Excedeu 1000 req/hora.                                         |
| 500  | `INTERNAL_ERROR`        | Erro interno. Se persistir, abra um chamado no suporte.        |

---

**Versão da API:** v1
**Última atualização:** 2026-05-04
