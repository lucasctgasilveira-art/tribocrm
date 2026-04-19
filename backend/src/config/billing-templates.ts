/**
 * IDs dos templates transacionais da Brevo usados pelo billing.
 * Cada valor corresponde ao ID numérico atribuído pela Brevo ao
 * template criado no painel (app.brevo.com/templates).
 *
 * IMPORTANTE: Se um template for EXCLUÍDO e RECRIADO na Brevo,
 * o ID muda. Atualizar este arquivo quando isso acontecer.
 *
 * Sub-etapa 6L (futura) vai migrar essas constantes pra tabela
 * EmailRule com UI de admin. Por ora, valores fixos no código.
 */
export const BILLING_TEMPLATES = {
  TRIAL_D7: 2,
  TRIAL_D3: 3,
  TRIAL_D1: 4,
  OVERDUE_D0: 5,
  OVERDUE_D7: 6,
  SUSPENDED_D10: 7,
} as const

export type BillingTemplateKey = keyof typeof BILLING_TEMPLATES
