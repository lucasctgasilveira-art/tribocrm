import { prisma } from '../lib/prisma'

/**
 * Daily at 09:00 — find tenants with expired trial or overdue charges.
 * Notes:
 * - The TenantStatus enum has no OVERDUE state, so we keep the current
 *   status and just notify the tenant's owners. Suspension is manual.
 * - Notifications go to OWNER/MANAGER users of the tenant (Super Admin
 *   notifications would require a separate AdminNotification table).
 */
export async function runOverdueChargesJob(): Promise<void> {
  const start = Date.now()
  console.log('[Job:overdue-charges] start')

  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 1) Trials that have expired (still in TRIAL status, trialEndsAt < today)
    const expiredTrials = await prisma.tenant.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lt: today },
      },
      select: { id: true, name: true, tradeName: true, trialEndsAt: true },
    })

    // 2) Active tenants with overdue charges (PENDING/OVERDUE charges past dueDate)
    const tenantsWithOverdueCharges = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        charges: {
          some: {
            status: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { lt: today },
            paidAt: null,
          },
        },
      },
      select: {
        id: true, name: true, tradeName: true,
        charges: {
          where: { status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lt: today }, paidAt: null },
          orderBy: { dueDate: 'asc' },
          take: 1,
          select: { dueDate: true, amount: true },
        },
      },
    })

    let notifyCount = 0
    const allTenants = [
      ...expiredTrials.map(t => ({ id: t.id, displayName: t.tradeName ?? t.name, since: t.trialEndsAt, kind: 'trial' as const })),
      ...tenantsWithOverdueCharges.map(t => ({ id: t.id, displayName: t.tradeName ?? t.name, since: t.charges[0]?.dueDate, kind: 'charge' as const })),
    ]

    for (const t of allTenants) {
      const recipients = await prisma.user.findMany({
        where: { tenantId: t.id, deletedAt: null, isActive: true, role: { in: ['OWNER', 'MANAGER'] } },
        select: { id: true },
      })
      const sinceLabel = t.since ? new Date(t.since).toLocaleDateString('pt-BR') : 'data desconhecida'
      const body = t.kind === 'trial'
        ? `Seu período de trial terminou em ${sinceLabel}. Regularize para manter o acesso.`
        : `Há cobrança em aberto desde ${sinceLabel}. Regularize para manter o acesso.`

      for (const r of recipients) {
        await prisma.notification.create({
          data: {
            tenantId: t.id,
            userId: r.id,
            type: 'DISCOUNT_PENDING', // closest existing enum value
            title: t.kind === 'trial' ? 'Trial expirado' : 'Pagamento em atraso',
            body,
          },
        })
        notifyCount++
      }
    }

    console.log(`[Job:overdue-charges] done — ${expiredTrials.length} expired trials, ${tenantsWithOverdueCharges.length} overdue, ${notifyCount} notifications (${Date.now() - start}ms)`)
  } catch (error) {
    console.error('[Job:overdue-charges] error:', error)
  }
}
