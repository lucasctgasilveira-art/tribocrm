# Pendências de Documentação — Fase Billing

**Objetivo:** consolidar mudanças implementadas na fase billing (sub-etapas 6A–6L) para atualização em lote nos documentos principais do projeto após conclusão da 6K.

**Última atualização:** 20/04/2026 (após 6K.2)

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

### Sub-etapa 6K.3 — Unit tests runBillingStateMachineJob (PENDENTE)
**Status:** Pendente (próxima sub-etapa)

**Escopo planejado:**
- Mocks de prisma (findMany, updateMany, charge.create/findFirst)
- Mock de sendTemplateMail
- Mock de createPixCharge / createBoletoCharge
- 10 cenários: TRIAL D-7/D-3/D-1, trial expirado, OVERDUE D+7, SUSPENDED D+10, idempotência, race condition, skip guards, error handling
- vi.useFakeTimers() + vi.setSystemTime

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
- [ ] Doc 00 (índice mestre) — refletir tudo
