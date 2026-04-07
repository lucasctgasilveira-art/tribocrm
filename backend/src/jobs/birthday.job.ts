import { prisma } from '../lib/prisma'

/**
 * Daily at 08:00 — find users whose birthday matches today (day + month)
 * and notify their tenant's OWNER/MANAGER users.
 */
export async function runBirthdayJob(): Promise<void> {
  const start = Date.now()
  console.log('[Job:birthday] start')

  try {
    const today = new Date()
    const day = today.getDate()
    const month = today.getMonth() + 1

    // Postgres: extract month/day from birthday
    const birthdayUsers = await prisma.$queryRaw<Array<{ id: string; tenantId: string; name: string }>>`
      SELECT id, tenant_id AS "tenantId", name
      FROM users
      WHERE deleted_at IS NULL
        AND is_active = true
        AND birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = ${month}
        AND EXTRACT(DAY FROM birthday) = ${day}
    `

    if (birthdayUsers.length === 0) {
      console.log('[Job:birthday] no birthdays today')
      return
    }

    let notificationsCreated = 0
    for (const user of birthdayUsers) {
      const recipients = await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          deletedAt: null,
          isActive: true,
          role: { in: ['OWNER', 'MANAGER'] },
        },
        select: { id: true },
      })

      for (const r of recipients) {
        await prisma.notification.create({
          data: {
            tenantId: user.tenantId,
            userId: r.id,
            type: 'BIRTHDAY',
            title: 'Aniversário hoje',
            body: `Hoje é aniversário de ${user.name}!`,
          },
        })
        notificationsCreated++
      }
    }

    console.log(`[Job:birthday] done — ${birthdayUsers.length} birthdays, ${notificationsCreated} notifications (${Date.now() - start}ms)`)
  } catch (error) {
    console.error('[Job:birthday] error:', error)
  }
}
