import { prisma } from '../lib/prisma'
import { sendTemplateMail } from '../services/mailer.service'
import {
  resolveCampaignRecipients,
  type CampaignFilters,
  type CampaignAudience,
} from '../services/campaigns.service'

// Campaign runner — sub-etapa 6L.3.a.
//
// Processa 1 campanha PENDING por tick (cron a cada 1 min).
// Acquire lock atômico via updateMany(PENDING → RUNNING) — se outro
// tick pegou primeiro, count === 0 e skip silencioso.
// Cancelamento (status=CANCELLED gravado por outra rota) é checado
// a cada 10 iterações pra reduzir queries; se detectado, persiste
// progresso parcial e sai sem marcar COMPLETED.
// Crash recovery (6L.3.d): campanhas RUNNING há mais de 30min são
// marcadas como FAILED no início de cada tick — protege contra
// processo que crashou ou foi reiniciado no meio do envio. Os
// contadores sent/failed/skipped que já tinham sido persistidos
// (a cada 20 iter) ficam como stats finais.

const RATE_LIMIT_MS = 100
const ORPHAN_TIMEOUT_MS = 30 * 60 * 1000

async function recoverOrphanedCampaigns(): Promise<void> {
  const threshold = new Date(Date.now() - ORPHAN_TIMEOUT_MS)

  try {
    const result = await prisma.emailCampaign.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: threshold },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Campanha interrompida (processo reiniciado ou travou)',
        completedAt: new Date(),
      },
    })

    if (result.count > 0) {
      console.warn(`[CampaignRunner] recovered ${result.count} orphaned campaign(s) as FAILED`)
    }
  } catch (err: any) {
    // Não propaga — falha no recovery não deve bloquear o pickup
    // de novas campanhas PENDING. A próxima tick tenta de novo.
    console.error('[CampaignRunner] erro no recovery de órfãs:', err?.message)
  }
}

export async function runCampaignRunnerJob(): Promise<void> {
  try {
    await recoverOrphanedCampaigns()

    const next = await prisma.emailCampaign.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (!next) return

    const lockResult = await prisma.emailCampaign.updateMany({
      where: { id: next.id, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    if (lockResult.count === 0) {
      console.log(`[CampaignRunner] lock perdido pra ${next.id}, skip`)
      return
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: next.id },
    })

    if (!campaign) return

    console.log(`[CampaignRunner] iniciando campanha ${campaign.id} (template ${campaign.templateId})`)

    try {
      const recipients = await resolveCampaignRecipients(
        campaign.filtersJson as CampaignFilters,
        campaign.audience as CampaignAudience,
      )

      // Atualiza totalRecipients real (mundo pode ter mudado entre
      // o /send e o pickup do job).
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { totalRecipients: recipients.length },
      })

      let sent = 0
      let failed = 0
      let skipped = 0

      for (let i = 0; i < recipients.length; i++) {
        // Checa cancelamento a cada 10 iterações.
        if (i > 0 && i % 10 === 0) {
          const current = await prisma.emailCampaign.findUnique({
            where: { id: campaign.id },
            select: { status: true },
          })

          if (current?.status === 'CANCELLED') {
            console.log(`[CampaignRunner] campanha ${campaign.id} cancelada no item ${i}/${recipients.length}`)

            await prisma.emailCampaign.update({
              where: { id: campaign.id },
              data: {
                sent,
                failed,
                skipped,
                completedAt: new Date(),
              },
            })
            return
          }
        }

        const r = recipients[i]
        if (!r || !r.email) {
          skipped++
          continue
        }

        try {
          const result = await sendTemplateMail({
            to: r.email,
            templateId: campaign.templateId,
            params: campaign.paramsJson as Record<string, string | number>,
            tenantId: r.tenantId,
          })
          if (result.sent) sent++
          else failed++
        } catch (err: any) {
          console.error(`[CampaignRunner] falha pra ${r.email}: ${err?.message}`)
          failed++
        }

        // Persiste progresso a cada 20 envios.
        if ((i + 1) % 20 === 0) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { sent, failed, skipped },
          })
          console.log(`[CampaignRunner] campanha ${campaign.id} progresso ${i + 1}/${recipients.length}`)
        }

        if (i < recipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS))
        }
      }

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'COMPLETED',
          sent,
          failed,
          skipped,
          completedAt: new Date(),
        },
      })

      console.log(`[CampaignRunner] campanha ${campaign.id} completa: total=${recipients.length} sent=${sent} failed=${failed} skipped=${skipped}`)
    } catch (err: any) {
      console.error(`[CampaignRunner] erro na campanha ${campaign.id}:`, err?.message)

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'FAILED',
          errorMessage: err?.message?.slice(0, 500) ?? 'Erro desconhecido',
          completedAt: new Date(),
        },
      })
    }
  } catch (err: any) {
    console.error('[CampaignRunner] erro top-level:', err?.message)
  }
}
