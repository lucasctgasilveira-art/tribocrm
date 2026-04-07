import { prisma } from '../lib/prisma'

const THRESHOLDS_DAYS: Record<'HOT' | 'WARM' | 'COLD', number> = {
  HOT: 2,
  WARM: 5,
  COLD: 10,
}

/**
 * Every 2 hours — find ACTIVE leads with no recent activity based on
 * temperature thresholds. Notifies the lead's responsible user.
 * Skips leads that already have a notification of this type within the
 * last 24 hours.
 */
export async function runInactiveLeadsJob(): Promise<void> {
  const start = Date.now()
  console.log('[Job:inactive-leads] start')

  try {
    const now = new Date()
    const dedupeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    let totalNotified = 0

    for (const temp of ['HOT', 'WARM', 'COLD'] as const) {
      const cutoff = new Date(now.getTime() - THRESHOLDS_DAYS[temp] * 24 * 60 * 60 * 1000)
      const inactiveLeads = await prisma.lead.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          temperature: temp,
          OR: [
            { lastActivityAt: { lt: cutoff } },
            { lastActivityAt: null, createdAt: { lt: cutoff } },
          ],
        },
        select: { id: true, name: true, tenantId: true, responsibleId: true, lastActivityAt: true, createdAt: true },
      })

      for (const lead of inactiveLeads) {
        // Dedupe: skip if a similar notification exists in the last 24h
        const recent = await prisma.notification.findFirst({
          where: {
            tenantId: lead.tenantId,
            userId: lead.responsibleId,
            type: 'TASK_DUE',
            link: `/leads/${lead.id}`,
            createdAt: { gte: dedupeCutoff },
          },
          select: { id: true },
        })
        if (recent) continue

        const lastDate = lead.lastActivityAt ?? lead.createdAt
        const daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))

        await prisma.notification.create({
          data: {
            tenantId: lead.tenantId,
            userId: lead.responsibleId,
            type: 'TASK_DUE', // closest existing enum
            title: 'Lead sem contato',
            body: `${lead.name} está sem contato há ${daysSince} dia${daysSince !== 1 ? 's' : ''}`,
            link: `/leads/${lead.id}`,
          },
        })
        totalNotified++
      }
    }

    console.log(`[Job:inactive-leads] done — ${totalNotified} notifications (${Date.now() - start}ms)`)
  } catch (error) {
    console.error('[Job:inactive-leads] error:', error)
  }
}
