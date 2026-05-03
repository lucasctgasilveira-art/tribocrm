/**
 * Lib pra cálculos de período (mensal/trimestral/semestral/anual).
 *
 * Decisão de produto (Bug 5 — Reformulação de metas):
 *   Cadastro de meta é SEMPRE mensal. Trimestre/semestre/ano viram
 *   visualizações agregadas — soma das metas mensais que compõem o
 *   período. Isso simplifica a estrutura no banco (só MONTHLY) e dá
 *   flexibilidade ao gestor pra ter metas diferentes por mês.
 *
 * Formatos de periodReference:
 *   MONTHLY   "YYYY-MM"     ex: "2026-05"
 *   QUARTERLY "YYYY-Q[1-4]" ex: "2026-Q2"   (Q1=jan-mar, Q2=abr-jun, etc.)
 *   SEMESTRAL "YYYY-S[1-2]" ex: "2026-S1"   (S1=jan-jun, S2=jul-dez)
 *   YEARLY    "YYYY"        ex: "2026"      (jan-dez)
 */

export type AggregationPeriod = 'MONTHLY' | 'QUARTERLY' | 'SEMESTRAL' | 'YEARLY'

const MONTHLY_RE = /^(\d{4})-(\d{2})$/
const QUARTERLY_RE = /^(\d{4})-Q([1-4])$/
const SEMESTRAL_RE = /^(\d{4})-S([1-2])$/
const YEARLY_RE = /^(\d{4})$/

/**
 * Valida formato de periodReference para um dado período.
 * Não valida se a data é "razoável" (passado/futuro distante) — só forma.
 */
export function isValidPeriodReference(periodType: AggregationPeriod, ref: string): boolean {
  if (typeof ref !== 'string') return false
  switch (periodType) {
    case 'MONTHLY': {
      const m = ref.match(MONTHLY_RE)
      if (!m) return false
      const month = parseInt(m[2]!, 10)
      return month >= 1 && month <= 12
    }
    case 'QUARTERLY':
      return QUARTERLY_RE.test(ref)
    case 'SEMESTRAL':
      return SEMESTRAL_RE.test(ref)
    case 'YEARLY':
      return YEARLY_RE.test(ref)
  }
}

/**
 * Lista os meses (formato "YYYY-MM") que compõem um período.
 * Retorna [] se o periodReference for inválido.
 *
 * Ex: getMonthsInPeriod('QUARTERLY', '2026-Q2')
 *   → ['2026-04', '2026-05', '2026-06']
 */
export function getMonthsInPeriod(periodType: AggregationPeriod, ref: string): string[] {
  if (!isValidPeriodReference(periodType, ref)) return []

  if (periodType === 'MONTHLY') return [ref]

  if (periodType === 'QUARTERLY') {
    const m = ref.match(QUARTERLY_RE)!
    const year = m[1]!
    const q = parseInt(m[2]!, 10)
    const startMonth = (q - 1) * 3 + 1
    return [0, 1, 2].map(i => `${year}-${String(startMonth + i).padStart(2, '0')}`)
  }

  if (periodType === 'SEMESTRAL') {
    const m = ref.match(SEMESTRAL_RE)!
    const year = m[1]!
    const s = parseInt(m[2]!, 10)
    const startMonth = (s - 1) * 6 + 1
    return Array.from({ length: 6 }, (_, i) =>
      `${year}-${String(startMonth + i).padStart(2, '0')}`,
    )
  }

  // YEARLY
  return Array.from({ length: 12 }, (_, i) => `${ref}-${String(i + 1).padStart(2, '0')}`)
}

/**
 * Inverso utilitário: dado um mês "YYYY-MM", retorna o periodReference
 * correspondente para cada nível de agregação. Útil pra pré-selecionar
 * o filtro certo quando o gestor está olhando um mês específico.
 */
export function buildPeriodReferenceFromMonth(month: string): {
  monthly: string
  quarterly: string
  semestral: string
  yearly: string
} | null {
  const m = month.match(MONTHLY_RE)
  if (!m) return null
  const year = m[1]!
  const monthNum = parseInt(m[2]!, 10)
  if (monthNum < 1 || monthNum > 12) return null

  const q = Math.ceil(monthNum / 3)
  const s = monthNum <= 6 ? 1 : 2

  return {
    monthly: month,
    quarterly: `${year}-Q${q}`,
    semestral: `${year}-S${s}`,
    yearly: year,
  }
}
