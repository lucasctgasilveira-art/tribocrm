import { prisma } from '../lib/prisma'

/**
 * Daily at 10:00 — check progress of active monthly goals.
 * - >= 100% achieved: send celebration notification
 * - In the last 5 days of the month and < 70%: send risk alert
 * Dedupes by checking if a notification of the same type was sent today.
 */
export async function runGoalCheckJob(): Promise<void> {
  const start = Date.now()
  console.log('[Job:goal-check] start')

  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const periodReference = `${year}-${String(month).padStart(2, '0')}`

    const lastDayOfMonth = new Date(year, month, 0).getDate()
    const isLast5Days = lastDayOfMonth - now.getDate() <= 5

    const startOfMonth = new Date(year, month - 1, 1)
    const startOfNextMonth = new Date(year, month, 1)
    const startOfToday = new Date(year, month - 1, now.getDate())

    const goals = await prisma.goal.findMany({
      where: { periodType: 'MONTHLY', periodReference },
      include: {
        individualGoals: { select: { userId: true, revenueGoal: true } },
        tenant: { select: { id: true } },
      },
    })

    let notified = 0
    for (const goal of goals) {
      // Aggregate revenue closed this month for this tenant + pipeline
      const won = await prisma.lead.aggregate({
        where: {
          tenantId: goal.tenantId,
          pipelineId: goal.pipelineId,
          status: 'WON',
          wonAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { closedValue: true },
      })

      const totalRevenue = Number(won._sum.closedValue ?? 0)
      const goalValue = Number(goal.totalRevenueGoal ?? 0)
      if (goalValue <= 0) continue

      const percentage = Math.round((totalRevenue / goalValue) * 100)

      // Find OWNER/MANAGER recipients of this tenant
      const recipients = await prisma.user.findMany({
        where: { tenantId: goal.tenantId, deletedAt: null, isActive: true, role: { in: ['OWNER', 'MANAGER'] } },
        select: { id: true, name: true },
      })

      for (const r of recipients) {
        // Dedupe: skip if a GOAL_ALERT was sent to this user today linking to this goal
        const existing = await prisma.notification.findFirst({
          where: {
            tenantId: goal.tenantId,
            userId: r.id,
            type: 'GOAL_ALERT',
            link: `/goals/${goal.id}`,
            createdAt: { gte: startOfToday },
          },
          select: { id: true },
        })
        if (existing) continue

        if (percentage >= 100) {
          await prisma.notification.create({
            data: {
              tenantId: goal.tenantId,
              userId: r.id,
              type: 'GOAL_ALERT',
              title: 'Meta atingida!',
              body: `Parabéns, ${r.name}! A meta de ${periodReference} foi atingida (${percentage}%).`,
              link: `/goals/${goal.id}`,
            },
          })
          notified++
        } else if (isLast5Days && percentage < 70) {
          await prisma.notification.create({
            data: {
              tenantId: goal.tenantId,
              userId: r.id,
              type: 'GOAL_ALERT',
              title: 'Meta em risco',
              body: `Atenção: meta de ${periodReference} está em ${percentage}% concluído com poucos dias restantes.`,
              link: `/goals/${goal.id}`,
            },
          })
          notified++
        }
      }
    }

    console.log(`[Job:goal-check] done — ${goals.length} goals, ${notified} notifications (${Date.now() - start}ms)`)
  } catch (error) {
    console.error('[Job:goal-check] error:', error)
  }
}
