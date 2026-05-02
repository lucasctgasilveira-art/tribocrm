/**
 * Calcula as 3 opções de mês de início da divisão de meta (rampagem)
 * conforme regra do Documento de Requisitos seção 6.3:
 *
 *   - Se hoje é dia 1-19: opções começam no mês atual
 *     (mês atual / próximo / subsequente)
 *   - Se hoje é dia 20+: opções começam no próximo mês
 *     (próximo / subsequente / seguinte) — descarta mês atual porque
 *     não faz sentido contar meta de quem entrou faltando 10 dias
 *     pra fechar o mês.
 *
 * Formato `value`: "YYYY-MM" (espelha a coluna User.rampingStartsAt
 * convertida — backend grava 1º dia do mês escolhido como Date).
 * Formato `label`: "Maio/2026" — UI legível.
 */

export interface RampingMonthOption {
  value: string
  label: string
}

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function getRampingMonthOptions(today: Date = new Date()): RampingMonthOption[] {
  const day = today.getDate()
  // Regra do doc: 1-19 = pode começar no mês atual; 20+ = começa no próximo.
  const offset = day >= 1 && day <= 19 ? 0 : 1

  const options: RampingMonthOption[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset + i, 1)
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
 * Converte um valor "YYYY-MM-DD" (ou ISO date completo) que veio do
 * backend (User.rampingStartsAt é @db.Date) pra "YYYY-MM" usado nos
 * selects da UI. Retorna null se input inválido/vazio.
 */
export function isoDateToMonth(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}`
}

/**
 * Pra editar um vendedor que já tem rampingStartsAt fora das 3 opções
 * padrão (ex: gestor cadastrou semana passada com mês X, hoje a regra
 * 1-19/20+ gera 3 opções diferentes), mostra também o valor atual no
 * select pra não perder a referência.
 */
export function ensureCurrentValueInOptions(
  options: RampingMonthOption[],
  currentValue: string | null,
): RampingMonthOption[] {
  if (!currentValue) return options
  if (options.some(o => o.value === currentValue)) return options
  const [yStr, mStr] = currentValue.split('-')
  const y = parseInt(yStr ?? '', 10)
  const m = parseInt(mStr ?? '', 10) - 1
  if (!Number.isInteger(y) || m < 0 || m > 11) return options
  return [
    { value: currentValue, label: `${MONTH_NAMES_PT[m]}/${y} (atual)` },
    ...options,
  ]
}
