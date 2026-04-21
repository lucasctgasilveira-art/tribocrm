# Pendências de Documentação — Fase Billing

**Objetivo:** consolidar mudanças implementadas na fase billing (sub-etapas 6A–6L) para atualização em lote nos documentos principais do projeto após conclusão da 6K.

**Última atualização:** 20/04/2026 (após 6L.2)

---

## Alterações implementadas e pendentes de documentação

### Sub-etapa 6A — Migration billing foundation
**Status:** Em produção (commit eb3bace)

**O que mudou:**
- Adicionado valor PAYMENT_OVERDUE ao enum TenantStatus
- Adicionadas 2 colunas ao modelo Tenant: lastBillingState (String, nullable), lastBillingStateAt (DateTime, nullable)

**Documentos impactados:**
- 07_Modelo_Banco_de_Dados.md
- 08_Arquitetura_do_Sistema.md

---

### Sub-etapa 6B — Templates Brevo + helper sendTemplateMail
**Status:** Em produção (commit 34fe1e9)

**O que mudou:**
- Provider de e-mail mudou de Resend (planejado) para Brevo (implementado)
- 6 templates transacionais criados na Brevo (#2 D-7, #3 D-3, #4 D-1, #5 D+0, #6 D+7, #7 D+10)
- Helper sendTemplateMail() em backend/src/services/mailer.service.ts
- Novo arquivo backend/src/config/billing-templates.ts
- Remetente: contato@tribocrm.com.br / Lucas Silveira | TriboCRM

**Documentos impactados:**
- 08_Arquitetura_do_Sistema.md (Resend → Brevo)
- 13_Manual_de_Onboarding.md
- 09_Estrutura_de_Codigo.md

---

### Sub-etapa 6C — State machine TRIAL
**Status:** Em produção (commits 24b5871 + 23dc50f)

**O que mudou:**
- Novo job backend/src/jobs/billing-state-machine.job.ts
- Cron 30 9 * * * (09:30 BRT)
- Nova rota POST /admin/jobs/billing-state-machine/run
- Régua TRIAL D-7/D-3/D-1 com templates correspondentes

**Documentos impactados:**
- 08_Arquitetura_do_Sistema.md
- 10_Documentacao_da_API.md

---

### Sub-etapa 6D — Geração automática de charges no D-3
**Status:** Em produção (commit 37ea78c)

**O que mudou:**
- Função generateChargeForTrialEnd() no billing-state-machine.job.ts
- Ao atingir D-3, cria Charge PIX ou Boleto baseado em tenant.preferredPaymentMethod
- Campos address no Tenant (street, number, neighborhood, zip, city, state, complement) necessários pra Boleto

**Documentos impactados:**
- 07_Modelo_Banco_de_Dados.md
- 10_Documentacao_da_API.md

---

### Sub-etapa 6E — Régua OVERDUE + fix webhook
**Status:** Em produção (commit 970d7a0)

**O que mudou:**
- Régua OVERDUE: D+0 → email #5 + status PAYMENT_OVERDUE + marca OVERDUE_D0_SENT
- D+7 → email #6 + marca OVERDUE_D7_SENT
- Fix crítico webhook: quando charge vira PAID, limpa lastBillingState e estende planExpiresAt (recovery automático OVERDUE→ACTIVE)

**Documentos impactados:**
- 08_Arquitetura_do_Sistema.md

---

### Sub-etapa 6F — Suspensão D+10
**Status:** Em produção (commit c9d9896)

**O que mudou:**
- D+10 após trial → status SUSPENDED + email #7 + marca SUSPENDED_D10_SENT

---

### Sub-etapa 6G — Middleware tenantStatusGuard
**Status:** Em produção (commit f9263ab)

**O que mudou:**
- Novo backend/src/middleware/tenant-status.middleware.ts
- Cache 30s pra reduzir queries
- Bloqueia todas as rotas (exceto /auth/*, /payments/*) se SUSPENDED ou CANCELLED
- Retorna 403 com code TENANT_SUSPENDED ou TENANT_CANCELLED

**Documentos impactados:**
- 08_Arquitetura_do_Sistema.md
- 10_Documentacao_da_API.md

---

### Fix build — nixpacks.toml
**Status:** Em produção (commit fdeba45)

**O que mudou:**
- Railway NODE_ENV=production pulava devDependencies
- Fix: backend/nixpacks.toml força --include=dev no install

---

### Sub-etapa 6H — Frontend UI de billing
**Status:** Em produção (commit 01d0fa3)

**O que mudou:**
- Novos componentes em frontend/src/components/billing/: BillingBanner, BillingOverduePopup, SuspendedPage, TenantStatusGate
- Novo hook useCurrentTenant com cache 60s e invalidateCurrentTenantCache
- Backend /auth/me expõe lastBillingState + lastBillingStateAt
- API interceptor detecta 403 TENANT_SUSPENDED e redireciona
- AppLayout envolto em TenantStatusGate

**Documentos impactados:**
- 03_Jornadas_de_Usuario.md
- 12_Design_das_Instancias.md

---

### Sub-etapa 6J.1 — Investigação cartão recorrente
**Status:** Concluída (sem commit)

**O que mudou:**
- Mapeamento do SDK Efi (oneStepSubscription, cancelSubscription, getNotification)
- Decisão: Efi.js no frontend pra tokenização (PCI-DSS), backend chama oneStepSubscription com token

---

### Sub-etapa 6J.2 — Migration subscription
**Status:** Em produção (commit 83807df)

**O que mudou:**
- 5 campos novos no Tenant: efiSubscriptionId, efiSubscriptionStatus, cardLastFour, cardBrand, cardExpiresAt, nextBillingAt
- 1 campo novo no Charge: efiSubscriptionId
- 1 campo novo no User: cpf VARCHAR(14)

**Documentos impactados:**
- 07_Modelo_Banco_de_Dados.md

---

### Sub-etapa 6J.3 — Backend assinatura real Efi
**Status:** Em produção (commit b73272d)

**O que mudou:**
- createCardSubscription() real (substituiu stub)
- Usa oneStepSubscription com EFI_PLAN_ID_MONTHLY=133165 e EFI_PLAN_ID_YEARLY=133166
- Nova cancelCardSubscription()
- Fix crítico em POST /payments/cancel: agora cancela NA EFI, não só marca DB
- Zod validation no body de /card-subscription

**Documentos impactados:**
- 10_Documentacao_da_API.md

---

### Sub-etapa 6J.4 — Webhook notification
**Status:** Em produção (commit a770f84)

**O que mudou:**
- Nova processSubscriptionNotification() em efi.service.ts
- Resolve notification token via getNotification
- Cria Charge local idempotente pra recorrência 2º+ ciclo
- Delega pro processWebhookPayment quando status=paid
- Novo branch no webhook handler entre Boleto e fallback

---

### Sub-etapa 6J.5.1 — Wrapper Efi.js + endpoint form-data
**Status:** Em produção (commit 8f1663a)

**O que mudou:**
- frontend/src/services/efiJs.ts — wrapper idempotente + getCardToken + detectBrand
- GET /payments/subscription-form-data — retorna customer + billingAddress + plan ou 400 INCOMPLETE_PROFILE
- Env vars frontend: VITE_EFI_PAYEE_CODE + VITE_EFI_SANDBOX

---

### Sub-etapa 6J.5.2 — CardSubscriptionForm
**Status:** Em produção (commit 4210a61)

**O que mudou:**
- Novo componente frontend/src/components/billing/CardSubscriptionForm.tsx (576 linhas)
- 3 caminhos de render: loading, INCOMPLETE_PROFILE, form completo
- 5 seções: resumo, titular (readonly), endereço (readonly), cartão (editável), botões
- Tokeniza via Efi.js → POST /card-subscription
- Toast caseiro + loader no botão + campos disabled durante submit

---

### Sub-etapa 6J.5.3 — Integração MySubscriptionPage
**Status:** Em produção (commit c47d6ca)

**O que mudou:**
- _CardPaymentModal removido (dead code)
- CardSubscriptionForm integrado em PaymentFlowModal e ChangeMethodModal
- Rota /gestao/perfil corrigida pra /gestao/configuracoes no CardSubscriptionForm
- invalidateCurrentTenantCache antes do window.location.reload
- CardForm legado mantido no arquivo (dead code, tree-shaking remove do bundle)
- Arquivo reduzido 1034 → 987 linhas

---

### Sub-etapa 6K.1 — Setup Vitest
**Status:** Em produção (commit b51ec7d)

**O que mudou:**
- 3 devDeps: vitest 4.1.4, vitest-mock-extended 4.0.0, @vitest/coverage-v8 4.1.4
- backend/vitest.config.ts (globals, environment node)
- backend/vitest.setup.ts (placeholder)
- backend/src/__tests__/smoke.test.ts (2 testes)
- 3 scripts: test, test:watch, test:coverage
- Reference directive vitest/globals no smoke.test.ts

**Documentos impactados:**
- 09_Estrutura_de_Codigo.md (pasta __tests__ e padrão .test.ts colocation)

---

### Sub-etapa 6K.2 — Unit tests funções puras
**Status:** Em produção (commit 22429c6)

**O que mudou:**
- 6 funções puras do billing-state-machine ganharam export: daysUntil, formatValor, formatDataBR, formatMetodo, getFirstName, buildParamsForState
- Novo backend/src/jobs/billing-state-machine.job.test.ts (220 linhas, 31 testes)
- formatBR mantido interno (testado indiretamente via formatValor)
- Total 33 testes verdes em menos de 600ms

---

### Sub-etapa 6K.3a — Unit tests TRIAL lane
**Status:** Em produção (commit a98f0b2)

**O que mudou:**
- 10 novos unit tests em billing-state-machine.job.test.ts cobrindo:
  * D-7 fresh (dispara template 2)
  * D-3 fresh × 4 (PIX / BOLETO / charge existente / sem preferredPaymentMethod)
  * D-1 fresh (dispara template 4)
  * Idempotência D-7
  * Skip guards (sem owner / sem trialEndsAt)
  * Error handling (sendTemplateMail sent:false preserva state)
- Setup de mocks via vitest-mock-extended: mockDeep<PrismaClient>() + vi.mock em mailer.service e efi.service
- Factory makeTenant reutilizável
- vi.useFakeTimers() + setSystemTime(2026-04-20) pra datas determinísticas

---

### Sub-etapa 6K.3b — Unit tests OVERDUE + SUSPENDED + edge cases
**Status:** Em produção (commit 0563cd6)

**O que mudou:**
- 8 novos unit tests organizados em sibling describe:
  * OVERDUE lane: D+0 fresh (TRIAL→OVERDUE) / D+0 legacy / D+7 fresh / idempotência D+0 e D+7
  * SUSPENDED lane: D+10 fresh (OVERDUE→SUSPENDED)
  * Edge cases: race condition (updateMany count=0) / legacy TRIAL_EXPIRED marker
- Total final: 51 tests verdes (2 smoke + 31 puros + 10 TRIAL + 8 OVERDUE) em <600ms
- Régua de billing completamente coberta contra regressão

---

### Sub-etapa 6L.1.a — Migration email_logs + persistência no mailer
**Status:** Em produção (commit cf6b899)

**O que mudou:**
- Nova migration add_email_logs criando tabela email_logs:
  * id, tenantId, toEmail, templateId, subject, status
  * brevoMessageId, errorReason, errorDetails, paramsJson
  * sentAt
  * 2 índices: (tenantId, sentAt desc) e (status, sentAt desc)
- Helper logEmailAttempt() em mailer.service.ts (fire-and-forget)
- tenantId? opcional adicionado a SendMailOptions e SendTemplateMailArgs
- 8 chamadores atualizados passando tenantId:
  * billing-state-machine.job.ts (tenant.id)
  * automation.service.ts (automation.tenantId)
  * expiry-alert.job.ts (t.id)
  * password.controller.ts (user.tenantId)
  * signup.controller.ts ×2 (created/user.tenantId)
  * users.controller.ts (tenantId local)
  * admin.routes.ts test-email (null)

**Documentos impactados:**
- 07_Modelo_Banco_de_Dados.md (tabela email_logs)

---

### Sub-etapa 6L.1.b — Rota admin GET /email-logs
**Status:** Em produção (commit 8e3c83e)

**O que mudou:**
- Nova rota GET /admin/email-logs em admin.routes.ts
- Query params (via Zod): status (single/array), templateId, tenantId, toEmail (LIKE), dateFrom, dateTo, limit (default 100, max 500), cursor (UUID)
- Paginação cursor-based com take: limit+1 pra detectar hasMore
- Response: { items, hasMore, nextCursor }
- authMiddleware + adminOnly herdados do router

**Documentos impactados:**
- 10_Documentacao_da_API.md

---

### Sub-etapa 6L.1.c — Página frontend EmailLogsPage
**Status:** Em produção (commit 5342092)

**O que mudou:**
- Nova página frontend/src/pages/admin/EmailLogsPage.tsx (620 linhas)
- Filtros inline no topo: status, busca por destinatário (debounce 400ms), dateFrom, dateTo, templateId
- Tabela com badge colorido de status (verde SENT, vermelho FAILED, cinza SKIPPED)
- Paginação "Carregar mais" (consome nextCursor)
- Modal de detalhes ao clicar linha: metadata grid + params JSON formatado + error details
- Fecha com ESC
- Rota nova: /admin/logs/emails
- Entrada "Logs de E-mails" (ícone Mail) no adminMenu.ts

**Documentos impactados:**
- 12_Design_das_Instancias.md (página admin)

---

### Sub-etapa 6L.2.a — Rotas admin campaign preview + send
**Status:** Em produção (commit aa335e0)

**O que mudou:**
- Nova rota POST /admin/campaign/preview: aceita filtros + audience, retorna { count, sample (até 10) }
- Nova rota POST /admin/campaign/send: loop sequencial chamando sendTemplateMail, rate limit 100ms entre envios, retorna { total, sent, failed, skipped, durationMs }
- Helper resolveCampaignRecipients reutilizado entre ambas
- Filtros simples: planIds, tenantStatuses, roles (todos opcionais)
- Audience: OWNERS ou ALL_USERS
- Emails gerados caem automaticamente em email_logs (6L.1.a)
- Role TEAM_LEADER confirmado no schema

**Limitação conhecida:** campanhas > 500 destinatários podem dar timeout HTTP. MVP documenta; 6L.3 migrará pra background job.

**Documentos impactados:**
- 10_Documentacao_da_API.md

---

### Sub-etapa 6L.2.b — Página frontend NewCampaignPage
**Status:** Em produção (commit 6b07eba)

**O que mudou:**
- Nova página frontend/src/pages/admin/NewCampaignPage.tsx (778 linhas)
- Seções: Template Brevo (ID + params JSON), Audiência (radio OWNERS/ALL_USERS), Filtros (chips clicáveis), Ações
- Plan multi-select dinâmico via GET /admin/plans
- Status e Role via chips coloridos
- Botão "Calcular prévia" → mostra count + sample inline
- Botão "Disparar" (habilitado só após prévia) → modal de confirmação
- Modal confirm: count, templateId, tempo estimado, warning vermelho
- Durante envio: full-screen com timer de segundos decorridos
- Resultado final: stats grid 2×2 + botões "Ver logs completos" e "Nova campanha"
- Roles escondidos quando audience=OWNERS (backend já força)
- Rota: /admin/emails/novo
- Entrada "Nova Campanha" (ícone Send) no menu admin

**Documentos impactados:**
- 12_Design_das_Instancias.md (página admin)

---

## Divergências detectadas entre docs e implementação

| Item | Doc afetado | Realidade em produção |
|---|---|---|
| Provider de email | 08 — menciona Resend | Brevo |
| Monitoramento Sentry | 08 — listado | Não implementado |
| Fonte tipográfica | 08 — menciona DM Sans única | DM Sans + Syne |
| Biblioteca de data | - | Date nativa, sem dayjs/date-fns |

---

## Quando atualizar

**Plano:** atualizar em lote após conclusão da 6L (UI admin de regras de email) ou quando sub-etapa de billing fechar definitivamente.

**Estimativa:** 2-3h pra revisão de todos os docs impactados.

---

## Checklist final (usar ao atualizar)

- [ ] Doc 07 — schema Tenant (billing + subscription fields + address) e enum TenantStatus
- [ ] Doc 07 — User.cpf, Charge.efiSubscriptionId
- [ ] Doc 08 — fluxo completo de pagamento Efi por estado
- [ ] Doc 08 — substituir Resend por Brevo
- [ ] Doc 08 — adicionar billing-state-machine aos jobs agendados
- [ ] Doc 08 — middleware stack incluindo tenantStatusGuard
- [ ] Doc 08 — revisar tabela de decisões arquiteturais
- [ ] Doc 09 — pasta config/ + pasta __tests__/ + padrão .test.ts colocation
- [ ] Doc 10 — POST /admin/jobs/billing-state-machine/run
- [ ] Doc 10 — POST /payments/card-subscription (schema Zod)
- [ ] Doc 10 — GET /payments/subscription-form-data
- [ ] Doc 10 — error codes TENANT_SUSPENDED / TENANT_CANCELLED / INCOMPLETE_PROFILE
- [ ] Doc 13 — 6 templates Brevo em E-mails Automáticos
- [ ] Doc 14 — política de suporte alinhada com cronograma real
- [ ] Doc 12 — telas de billing (BillingBanner, BillingOverduePopup, SuspendedPage, CardSubscriptionForm)
- [ ] Doc 03 — jornadas de inadimplência
- [ ] Doc 07 — tabela email_logs
- [ ] Doc 09 — pasta admin/ com EmailLogsPage e NewCampaignPage
- [ ] Doc 10 — GET /admin/email-logs
- [ ] Doc 10 — POST /admin/campaign/preview e /send
- [ ] Doc 12 — telas /admin/logs/emails e /admin/emails/novo
- [ ] Doc 00 (índice mestre) — refletir tudo
