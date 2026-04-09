import { prisma } from '../lib/prisma'
import { sendMail } from '../services/mailer.service'

/**
 * Daily at 11:00 — alert tenants whose plan expires within 3 days.
 *
 * For each matching tenant:
 *   1. Checks for duplicate notifications in the last 24h to avoid spam
 *   2. Creates a TASK_DUE notification for every OWNER of the tenant
 *   3. Sends an email via SMTP (if configured) with a renewal link
 */
export async function runExpiryAlertJob(): Promise<void> {
  const start = Date.now()
  console.log('[Job:expiry-alert] start')

  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const d3 = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Find active tenants expiring within 0–3 days
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        planExpiresAt: { gte: today, lte: d3 },
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        planExpiresAt: true,
      },
    })

    let notifyCount = 0
    let emailCount = 0

    for (const t of tenants) {
      const daysLeft = Math.max(0, Math.ceil(((t.planExpiresAt?.getTime() ?? 0) - now.getTime()) / (1000 * 60 * 60 * 24)))
      const displayName = t.tradeName ?? t.name

      // Find OWNER users of this tenant
      const owners = await prisma.user.findMany({
        where: { tenantId: t.id, deletedAt: null, isActive: true, role: 'OWNER' },
        select: { id: true, name: true, email: true },
      })

      for (const owner of owners) {
        // Dedup: skip if we already notified this user in the last 24h
        const recent = await prisma.notification.findFirst({
          where: {
            tenantId: t.id,
            userId: owner.id,
            type: 'TASK_DUE',
            title: 'Plano próximo do vencimento',
            createdAt: { gte: yesterday },
          },
          select: { id: true },
        })
        if (recent) continue

        const body = `Seu plano vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Renove para não perder o acesso.`

        await prisma.notification.create({
          data: {
            tenantId: t.id,
            userId: owner.id,
            type: 'TASK_DUE',
            title: 'Plano próximo do vencimento',
            body,
            link: '/gestao/assinatura',
          },
        })
        notifyCount++

        // Send email (fire-and-forget — mailer.service handles missing config)
        const emailResult = await sendMail({
          to: owner.email,
          subject: `Seu plano TriboCRM vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
          text: [
            `Olá ${owner.name},`,
            '',
            `O plano da empresa ${displayName} no TriboCRM vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}.`,
            '',
            'Renove agora para não perder o acesso:',
            'https://tribocrm.vercel.app/gestao/assinatura',
            '',
            'Equipe TriboCRM',
          ].join('\n'),
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
              <h2 style="color: #f59e0b; margin-bottom: 16px;">Seu plano vence em breve</h2>
              <p>Olá <strong>${owner.name}</strong>,</p>
              <p>O plano da empresa <strong>${displayName}</strong> no TriboCRM vence em <strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong>.</p>
              <p style="margin: 20px 0;">
                <a href="https://tribocrm.vercel.app/gestao/assinatura" style="background: #f97316; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Renovar agora</a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">Renove para não perder o acesso aos seus dados e funcionalidades.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af;">Equipe TriboCRM</p>
            </div>
          `,
        })
        if (emailResult.sent) emailCount++
      }

      console.log(`[Job:expiry-alert] tenant "${displayName}" expires in ${daysLeft}d — notified ${owners.length} owner(s)`)
    }

    console.log(`[Job:expiry-alert] done — ${tenants.length} tenants expiring, ${notifyCount} notifications, ${emailCount} emails (${Date.now() - start}ms)`)
  } catch (error) {
    console.error('[Job:expiry-alert] error:', error)
  }
}
