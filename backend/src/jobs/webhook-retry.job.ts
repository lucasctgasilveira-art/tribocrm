import { prisma } from '../lib/prisma'
import { processDelivery } from '../services/webhook-dispatcher.service'

/**
 * Processa deliveries de webhook que falharam e estão na janela de
 * retry. Roda a cada 1 minuto.
 *
 * Lógica:
 *   - Pega até 100 deliveries com status=PENDING e nextRetryAt <= now()
 *   - Pra cada uma, chama processDelivery (que tenta entrega + atualiza status)
 *   - Se sucesso → SUCCESS. Se falha mas ainda tem tentativas → reagenda.
 *     Se esgotou → FAILED.
 *
 * Job NÃO trata deliveries com status=PENDING e nextRetryAt=NULL (essas
 * são as que acabaram de ser criadas pelo trigger inicial — quem cria
 * já dispara processDelivery na hora). Só pegamos as que precisam ser
 * "ressuscitadas" do estado de espera.
 */
export async function runWebhookRetryJob(): Promise<void> {
  const now = new Date()

  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: 100,
    select: { id: true },
  })

  if (due.length === 0) return

  console.log(`[Job:webhook-retry] processando ${due.length} deliveries`)

  // Sequencial — não vale a pena martelar 100 endpoints externos
  // simultaneamente. Se isso virar gargalo no futuro, pode trocar
  // pra Promise.allSettled em batches.
  for (const d of due) {
    try {
      await processDelivery(d.id)
    } catch (err: any) {
      console.error(`[Job:webhook-retry] processDelivery ${d.id} falhou:`, err?.message ?? err)
    }
  }
}
