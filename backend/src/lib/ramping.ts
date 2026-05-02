/**
 * Lib pra cálculo de rampagem de vendedores em metas.
 *
 * Conceito (Documento de Requisitos seções 6.3, 6.9, 13.7):
 *   Rampagem é uma regra de QUANDO o vendedor começa a participar da
 *   divisão da meta da equipe — NÃO é meta proporcional aos dias.
 *   Enquanto está em rampagem, ele não conta na divisão; a meta total
 *   é dividida apenas entre os demais vendedores ativos.
 *
 * UX do cadastro:
 *   Gestor escolhe um "mês de início da divisão" no momento de cadastrar
 *   o vendedor. Esse valor é gravado em User.rampingStartsAt (DATE — 1º
 *   dia do mês escolhido). Vendedor sem esse campo entra normal em todas
 *   as metas (sem rampagem).
 *
 * Tradução pra metas trimestrais/anuais:
 *   Aplica-se a mesma regra mensal: o vendedor está em rampagem para
 *   uma meta cujo último mês coberto é ANTERIOR ao mês de início dele.
 *   Ex: vendedor com rampingStartsAt='2026-07-01' está em rampagem pra
 *   meta trimestral '2026-Q2' (abr-mai-jun, último=jun) porque jul > jun.
 */

export type GoalPeriodType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

/**
 * Retorna true se o vendedor está em rampagem para a meta indicada.
 *
 * @param rampingStartsAt   Data de início da participação na divisão.
 *                          NULL = vendedor já participa de tudo.
 * @param periodType        MONTHLY | QUARTERLY | YEARLY
 * @param periodReference   String formatada conforme periodType:
 *                            MONTHLY:   "YYYY-MM"   ex: "2026-05"
 *                            QUARTERLY: "YYYY-Q[1-4]" ex: "2026-Q2"
 *                            YEARLY:    "YYYY"      ex: "2026"
 */
export function isUserInRamping(
  rampingStartsAt: Date | null,
  periodType: GoalPeriodType,
  periodReference: string
): boolean {
  if (!rampingStartsAt) return false

  const y = rampingStartsAt.getFullYear()
  const m = String(rampingStartsAt.getMonth() + 1).padStart(2, '0')
  const userStartsMonth = `${y}-${m}`

  const periodLastMonth = lastMonthCoveredByPeriod(periodType, periodReference)
  if (!periodLastMonth) return false

  // Comparação lexicográfica funciona porque ambos estão em "YYYY-MM"
  return userStartsMonth > periodLastMonth
}

/**
 * Retorna o último mês coberto por um período, em formato "YYYY-MM".
 * Útil pra comparar com o mês de início da rampagem do vendedor.
 *
 * Retorna null se o periodReference for inválido.
 */
export function lastMonthCoveredByPeriod(
  periodType: GoalPeriodType,
  periodReference: string
): string | null {
  if (periodType === 'MONTHLY') {
    return /^\d{4}-\d{2}$/.test(periodReference) ? periodReference : null
  }
  if (periodType === 'QUARTERLY') {
    const match = periodReference.match(/^(\d{4})-Q([1-4])$/)
    if (!match) return null
    const year = match[1]!
    const q = parseInt(match[2]!, 10)
    const lastMonth = q * 3
    return `${year}-${String(lastMonth).padStart(2, '0')}`
  }
  if (periodType === 'YEARLY') {
    return /^\d{4}$/.test(periodReference) ? `${periodReference}-12` : null
  }
  return null
}
