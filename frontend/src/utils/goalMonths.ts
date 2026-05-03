/**
 * Helpers pra UI de cadastro/seleção de meta mensal.
 *
 * Decisão de produto Bug 5 (Alternativa A): cadastro de meta é sempre
 * mensal, com seletor de mês/ano. Trimestre/semestre/ano viram
 * visualizações agregadas (frontend soma os meses correspondentes).
 *
 * Aceita cadastro retroativo (mês passado) — gestor às vezes precisa
 * ajustar uma meta de mês anterior.
 */

export interface GoalMonthOption {
  value: string  // "YYYY-MM"
  label: string  // "Maio/2026"
}

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/**
 * Gera opções de mês a partir de hoje. Default: 6 meses passados +
 * mês atual + 12 futuros (19 opções). Suficiente pra qualquer cadastro
 * de meta mensal/trimestral/anual.
 */
export function getGoalMonthOptions(
  today: Date = new Date(),
  monthsBack: number = 6,
  monthsForward: number = 12,
): GoalMonthOption[] {
  const options: GoalMonthOption[] = []
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    options.push({
      value: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES_PT[m]}/${y}`,
    })
  }
  return options
}

/**
 * Mês atual no formato "YYYY-MM" — útil como default selecionado.
 */
export function currentMonthValue(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

// ── Helpers pra filtros agregados (Bug 5 Fase A3) ──

export type AggregationPeriod = 'MONTHLY' | 'QUARTERLY' | 'SEMESTRAL' | 'YEARLY'

export interface PeriodOption {
  value: string
  label: string
}

const QUARTER_LABELS = ['1º Trimestre (Jan-Mar)', '2º Trimestre (Abr-Jun)', '3º Trimestre (Jul-Set)', '4º Trimestre (Out-Dez)']
const SEMESTRE_LABELS = ['1º Semestre (Jan-Jun)', '2º Semestre (Jul-Dez)']

/**
 * Lista os 5 anos centrados no ano atual (passado/atual/futuros) — base
 * pros seletores de Q/S/A. Suficiente pra visualizar histórico e
 * planejar metas futuras.
 */
function yearsRange(today: Date = new Date()): number[] {
  const y = today.getFullYear()
  return [y - 2, y - 1, y, y + 1, y + 2]
}

/**
 * Gera opções concretas pro segundo seletor (período específico) baseado
 * no tipo de agregação. Default selecionado é o período corrente.
 */
export function getPeriodOptions(periodType: AggregationPeriod, today: Date = new Date()): PeriodOption[] {
  if (periodType === 'MONTHLY') {
    return getGoalMonthOptions(today)
  }
  if (periodType === 'QUARTERLY') {
    return yearsRange(today).flatMap(y =>
      QUARTER_LABELS.map((label, i) => ({
        value: `${y}-Q${i + 1}`,
        label: `${label} ${y}`,
      })),
    )
  }
  if (periodType === 'SEMESTRAL') {
    return yearsRange(today).flatMap(y =>
      SEMESTRE_LABELS.map((label, i) => ({
        value: `${y}-S${i + 1}`,
        label: `${label} ${y}`,
      })),
    )
  }
  // YEARLY
  return yearsRange(today).map(y => ({ value: String(y), label: `Ano ${y}` }))
}

/**
 * Período corrente em formato compatível com o tipo de agregação.
 * Útil como default selecionado quando o gestor troca o tipo no filtro.
 */
export function currentPeriodValue(periodType: AggregationPeriod, today: Date = new Date()): string {
  const y = today.getFullYear()
  if (periodType === 'MONTHLY') return currentMonthValue(today)
  if (periodType === 'YEARLY') return String(y)
  const m = today.getMonth() + 1
  if (periodType === 'QUARTERLY') {
    const q = Math.ceil(m / 3)
    return `${y}-Q${q}`
  }
  // SEMESTRAL
  const s = m <= 6 ? 1 : 2
  return `${y}-S${s}`
}
