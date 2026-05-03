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
