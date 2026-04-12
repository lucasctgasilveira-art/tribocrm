import { prisma } from '../lib/prisma'

/**
 * Monthly at 00:00 on day 1 (America/Sao_Paulo) — flip every
 * `status = WON` lead across every tenant to `status = ARCHIVED`.
 *
 * Why: the "Venda Realizada" column accumulates every closed lead
 * forever. Tenants want a clean slate at the start of each month,
 * while still being able to opt-in to see archived rows via the
 * kanban toggle (see getKanban's `includeArchived` query param).
 *
 * Safe across tenants: Prisma.updateMany is a single SQL UPDATE so
 * there's no per-tenant loop and no partial state. Wrapped in
 * try/catch because this job must never crash the process — if it
 * fails we log and skip to next month.
 */
export async function runWonCardsArchiverJob(): Promise<void> {
  const start = Date.now()
  console.log('[Job:wonCardsArchiver] start')

  try {
    const result = await prisma.lead.updateMany({
      where: { status: 'WON' },
      data: { status: 'ARCHIVED' },
    })
    console.log(`[Job:wonCardsArchiver] done — ${result.count} leads arquivados (${Date.now() - start}ms)`)
  } catch (error) {
    console.error('[Job:wonCardsArchiver] error:', error)
  }
}
