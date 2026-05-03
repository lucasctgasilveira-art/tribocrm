/**
 * Job de notificação push pra tarefas vencendo.
 *
 * Roda a cada 5 minutos. Pra cada tarefa pending cujo dueDate cai
 * dentro da janela "agora..agora+reminderMinutes" e ainda não foi
 * notificada, manda push pro responsável.
 *
 * Marca a flag `pushSent` (campo novo? não — usa interaction SYSTEM
 * dedupe via tag). Solução escolhida: campo simples `notifiedAt` na
 * própria task seria ideal, mas como não queremos mexer em schema,
 * usamos lookup em interactions com type=SYSTEM e content específico.
 *
 * Janela: 5 min de tolerância pra dar tempo de processar mesmo se o
 * cron atrasar. Default reminderMinutes=5 quando o campo é null.
 */

import { prisma } from '../lib/prisma'
import { sendPushToUser } from '../services/push-notification.service'

const TASK_REMINDER_PUSH_TAG = '[Push] Lembrete de tarefa enviado'

export async function runPushTaskReminderJob(): Promise<void> {
  try {
    const now = new Date()
    // Janela: tarefas com dueDate entre agora e agora+60min (cobre
    // qualquer reminderMinutes razoável em uma única query). Filtragem
    // fina por reminderMinutes é feita em código.
    const windowEnd = new Date(now.getTime() + 60 * 60 * 1000)

    const tasks = await prisma.task.findMany({
      where: {
        isDone: false,
        dueDate: { gte: now, lte: windowEnd, not: null },
      },
      include: {
        lead: { select: { id: true, name: true, company: true } },
      },
    })

    if (tasks.length === 0) return

    for (const t of tasks) {
      if (!t.dueDate) continue
      const reminderMin = t.reminderMinutes ?? 5
      const remindAt = new Date(t.dueDate.getTime() - reminderMin * 60 * 1000)

      // Já chegou a hora de avisar?
      if (remindAt > now) continue

      // Já avisamos esse user pra essa task? Lookup defensivo via
      // Interaction (type=SYSTEM, content específico, leadId).
      // Se task não tem leadId, não dá pra usar essa marcação — pulamos
      // o dedupe (raríssimo: tarefas gerenciais não têm leadId).
      if (t.leadId) {
        const alreadyNotified = await prisma.interaction.findFirst({
          where: {
            leadId: t.leadId,
            userId: t.responsibleId,
            type: 'SYSTEM',
            content: { startsWith: `${TASK_REMINDER_PUSH_TAG} ${t.id}` },
          },
          select: { id: true },
        })
        if (alreadyNotified) continue
      }

      const leadInfo = t.lead?.name
        ? ` — ${t.lead.name}${t.lead.company ? ` (${t.lead.company})` : ''}`
        : ''
      await sendPushToUser(t.responsibleId, {
        title: '⏰ Tarefa pra fazer agora',
        body: `${t.title}${leadInfo}`,
        url: t.leadId ? `/vendas/leads/${t.leadId}` : '/vendas/tarefas',
        tag: `task-${t.id}`,
      })

      // Marca dedupe via interaction (só pra tasks com lead)
      if (t.leadId) {
        await prisma.interaction.create({
          data: {
            tenantId: t.tenantId,
            leadId: t.leadId,
            userId: t.responsibleId,
            type: 'SYSTEM',
            content: `${TASK_REMINDER_PUSH_TAG} ${t.id}`,
            isAuto: true,
          },
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[Job:push-task-reminder] error:', err)
  }
}
