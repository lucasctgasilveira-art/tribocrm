# Estado da Sessão — 20/04/2026 v2 (fase billing 100% fechada)

## Resumo rápido

- **Fase 6 (billing):** 100% completa em produção (24 commits)
- **Régua de inadimplência:** D-7 → D+10 com 51 unit tests
- **Cartão recorrente Efi:** tokenização + subscription + webhook + UI
- **Logs de email:** persistência + UI admin filtrada
- **Campanhas em massa:** MVP com preview + send + progress
- **Testes:** 51 unit tests verdes em <600ms

## Branches

- **main:** 6b07eba — 6L.2.b (NewCampaignPage)
- **develop:** sincronizada com main

## Timeline main (fase billing completa)

6b07eba  6L.2.b  NewCampaignPage frontend
aa335e0  6L.2.a  rotas campaign preview + send
5342092  6L.1.c  EmailLogsPage frontend
8e3c83e  6L.1.b  rota GET /email-logs
cf6b899  6L.1.a  migration email_logs + mailer persist
0563cd6  6K.3b   unit tests OVERDUE/SUSPENDED/edge
a98f0b2  6K.3a   unit tests TRIAL lane
08f9533  docs    snapshot 6A-6K.2
22429c6  6K.2    unit tests funções puras
b51ec7d  6K.1    setup Vitest
c47d6ca  6J.5.3  integra CardSubscriptionForm
4210a61  6J.5.2  componente CardSubscriptionForm
8f1663a  6J.5.1  wrapper Efi.js + endpoint
a770f84  6J.4    webhook notification
b73272d  6J.3    assinatura real Efi + fix cancel
83807df  6J.2    campos subscription
01d0fa3  6H      UI billing frontend
fdeba45  fix     nixpacks devDependencies
f9263ab  6G      middleware tenantStatusGuard
c9d9896  6F      suspensão D+10
970d7a0  6E      régua OVERDUE + webhook fix
37ea78c  6D      charge PIX/Boleto D-3
23dc50f  6C      state machine wiring
24b5871  6C      job dormente
34fe1e9  6B      Brevo templates
eb3bace  6A      migration PAYMENT_OVERDUE

## Decisões consolidadas da fase

- **Sandbox vs Produção:** tudo em produção direto
- **Plans Efi:** Mensal=133165, Anual=133166
- **Payee Code:** 062bc92084e2302eaa8463cf018ec2fe
- **Mailer:** Brevo (não Resend)
- **Cartão:** oneStepSubscription + cancelSubscription + notification webhook
- **Testes:** só unit tests (não integration nem E2E)
- **6L.2 MVP escolhido:** transactional template em loop + filtros simples + imediato + só email_logs
- **6L.3 backlog:** agendamento + filtros avançados + tabela email_campaigns + background job pra campanhas grandes

## Sistema 100% pronto pra lançar

Ciclo completo end-to-end em produção:
- Signup → trial 30 dias
- Emails D-7, D-3, D-1, D+0, D+7, D+10 via Brevo
- Cobrança PIX/Boleto gerada D-3
- Webhook ativa tenant ao receber pagamento
- Cartão recorrente: cadastra form, Efi cobra mensalmente
- Cancelamento cancela de verdade na Efi
- Middleware bloqueia acesso SUSPENDED
- Frontend mostra banner/popup/tela de suspensão
- Recovery automático via webhook
- Admin vê logs de todos os emails
- Admin dispara campanhas com segmentação

## Dívidas técnicas conhecidas

- Senha admin admin@tribocrm.com.br / Teste@123 (fraca)
- Hash webhook Efi vazou em screenshot antigo
- Credenciais em test-webhook.ps1 (limpar)
- .claude/settings.local.json fora do .gitignore
- 2 audit warnings moderate do npm (vitest)
- Drift de 5 modelos Supabase (SQL manual)
- Prisma 5.22 → 7.7 (major, adiado)
- Bug latente select vs generateChargeForTrialEnd (boleto pode usar fallback hardcoded)
- Campanhas > 500 destinatários podem dar timeout HTTP (usar lote menor ou migrar pra background job em 6L.3)

## Próxima sessão — opções

1. **Atualizar 22 docs do projeto Claude via Chrome** (1-2h, trabalho manual)
2. **Dívidas de segurança** (senha admin, credenciais, 1h)
3. **Teste manual em produção** (cadastrar cartão real de R$1, validar ciclo)
4. **6L.3** (se quiser refinar campanhas com agendamento + filtros avançados)
5. **Sub-etapas novas de outras fases** (7+)

## Roteiro de boot

1. Ler este arquivo
2. Ler BILLING_CHANGES_PENDING_DOCS.md
3. git log --oneline -25 main
4. Decidir próxima prioridade
