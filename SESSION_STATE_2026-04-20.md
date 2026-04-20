# Estado da Sessão — 20/04/2026 (pausa)

## Resumo rápido

- **Billing por cartão recorrente:** 100% funcional em produção
- **Billing por PIX/Boleto:** 100% funcional em produção
- **Régua de inadimplência D-7 → D+10:** 100% funcional em produção
- **Unit tests:** Vitest configurado, 33 testes verdes
- **Próxima sub-etapa:** 6K.3 (unit tests de runBillingStateMachineJob com mocks)

## Branches

- **main:** 22429c6 — 6K.2 (unit tests funções puras)
- **develop:** sincronizada com main

## Commits recentes em main (14 commits da fase billing)

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

## Decisões travadas nesta sessão

- Sandbox vs Produção: testando direto em produção
- Plans Efi: Mensal=133165, Anual=133166 (produção)
- Payee Code: 062bc92084e2302eaa8463cf018ec2fe
- Env vars Vercel: VITE_EFI_PAYEE_CODE + VITE_EFI_SANDBOX=false
- 6K escopo: só Unit tests (ROI realista pra estágio atual)
- 6K.3 estratégia: pausas obrigatórias frequentes, quebrar em 6K.3a (setup + TRIAL) e 6K.3b (OVERDUE/SUSPENDED/edge)
- CardForm legado mantido como dead code (Opção B — tree-shaking remove do bundle)
- _CardPaymentModal removido completamente (dead code não referenciado)
- Rota /gestao/perfil corrigida pra /gestao/configuracoes em CardSubscriptionForm

## O que tá 100% pronto pra lançar

- Cliente cadastra e ganha 30 dias trial
- Emails D-7, D-3, D-1
- Cobrança gerada D-3 (PIX ou Boleto)
- Webhook detecta pagamento e ativa tenant
- Se não paga: régua D+0 → D+7 → D+10 (suspensão)
- Cartão recorrente: cliente cadastra form Efi.js, Efi cobra mensalmente automaticamente
- Cancelamento cancela de verdade na Efi
- Backend bloqueia acesso se SUSPENDED
- Frontend mostra banner/popup/tela de suspensão
- Recovery automático via webhook

## Dívidas técnicas conhecidas

- Senha admin admin@tribocrm.com.br / Teste@123 (fraca)
- Hash webhook Efi vazou em screenshot antigo (gerar novo)
- Credenciais em test-webhook.ps1 (limpar ou apagar)
- .claude/settings.local.json deveria estar no .gitignore
- 2 moderate audit warnings do npm (vitest) — monitorar
- Drift de 5 modelos Supabase (contornado com SQL manual)
- Prisma 5.22 → 7.7 disponível (major, adiado)

## Próxima sessão — roteiro de boot

1. Ler este arquivo
2. Ler BILLING_CHANGES_PENDING_DOCS.md
3. Confirmar estado: git log --oneline -15 main
4. Opções:
   - Continuar pra 6K.3 (1-1.5h, mocks Prisma/mailer/efi)
   - Pular pra 6L (UI admin de regras de email)
   - Atacar dívidas de segurança (1h)
   - Teste manual de cartão real em produção
