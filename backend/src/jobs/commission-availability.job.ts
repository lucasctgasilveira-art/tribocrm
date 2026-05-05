import { promoteAvailableCommissions } from '../services/commission-engine.service'

/**
 * Promove comissões PENDING → AVAILABLE quando atinge a data de
 * `availableAt` (charge.paidAt + 30 dias). Chamado diariamente
 * pelo cron — barato (apenas updateMany filtrado).
 *
 * Sem reversão automática: comissões REVERSED/PAID já têm
 * tratamento explícito em outras rotas.
 */
export async function runCommissionAvailabilityJob(): Promise<void> {
  try {
    const { promoted } = await promoteAvailableCommissions()
    if (promoted > 0) {
      console.log(`[Job:commission-availability] ${promoted} comissões promovidas pra AVAILABLE`)
    }
  } catch (err: any) {
    console.error('[Job:commission-availability] erro:', err?.message ?? err)
  }
}
