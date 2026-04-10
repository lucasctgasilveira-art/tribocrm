import { prisma } from '../lib/prisma'
import { executeAutomation } from '../services/automation.service'

/**
 * Every 5 minutes — automation engine.
 *
 * 1. Process pending AutomationEvents (event-based triggers)
 * 2. Poll for time-based triggers (INACTIVE_DAYS, TASK_OVERDUE)
 */
export async function runAutomationJob(): Promise<void> {
  const start = Date.now()
  let processed = 0
  let executed = 0

  try {
    // ── 1. Event-based triggers ──
    const events = await prisma.automationEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })

    for (const event of events) {
      try {
        const automations = await prisma.automation.findMany({
          where: {
            tenantId: event.tenantId,
            triggerType: event.triggerType,
            isActive: true,
          },
        })

        const lead = await prisma.lead.findUnique({
          where: { id: event.leadId },
          select: {
            id: true, tenantId: true, pipelineId: true, stageId: true,
            responsibleId: true, createdBy: true, name: true, email: true,
            phone: true, whatsapp: true, company: true,
          },
        })

        if (!lead) {
          await prisma.automationEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
          processed++
          continue
        }

        const payload = (event.payload ?? {}) as Record<string, any>

        for (const auto of automations) {
          const triggerConfig = (auto.triggerConfig ?? {}) as Record<string, any>

          // Check if the automation's pipeline filter matches
          if (auto.pipelineId && auto.pipelineId !== lead.pipelineId) continue

          // Evaluate trigger conditions
          if (!matchesTrigger(event.triggerType, triggerConfig, payload)) continue

          const result = await executeAutomation(auto, lead, prisma)

          await prisma.automationLog.create({
            data: {
              tenantId: event.tenantId,
              automationId: auto.id,
              leadId: lead.id,
              status: result,
              errorMessage: result === 'FAILED' ? `Action ${auto.actionType} failed` : null,
            },
          })
          executed++
        }

        await prisma.automationEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
        processed++
      } catch (err: any) {
        console.error(`[Job:automation] event ${event.id} error:`, err?.message ?? err)
        // Mark as processed to avoid infinite retry
        await prisma.automationEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } }).catch(() => {})
        processed++
      }
    }

    // ── 2. Poll-based triggers ──

    // INACTIVE_DAYS: find automations that trigger on inactivity
    const inactiveAutomations = await prisma.automation.findMany({
      where: { triggerType: 'INACTIVE_DAYS', isActive: true },
    })

    for (const auto of inactiveAutomations) {
      try {
        const config = (auto.triggerConfig ?? {}) as Record<string, any>
        const days = Number(config.days) || 7
        const cutoff = new Date(Date.now() - days * 86_400_000)

        const leads = await prisma.lead.findMany({
          where: {
            tenantId: auto.tenantId,
            status: 'ACTIVE',
            deletedAt: null,
            ...(auto.pipelineId ? { pipelineId: auto.pipelineId } : {}),
            lastActivityAt: { lt: cutoff },
          },
          select: {
            id: true, tenantId: true, pipelineId: true, stageId: true,
            responsibleId: true, createdBy: true, name: true, email: true,
            phone: true, whatsapp: true, company: true,
          },
          take: 50,
        })

        for (const lead of leads) {
          // Check if already executed today for this lead+automation
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const alreadyRan = await prisma.automationLog.findFirst({
            where: {
              automationId: auto.id,
              leadId: lead.id,
              executedAt: { gte: today },
            },
          })
          if (alreadyRan) continue

          const result = await executeAutomation(auto, lead, prisma)
          await prisma.automationLog.create({
            data: {
              tenantId: auto.tenantId,
              automationId: auto.id,
              leadId: lead.id,
              status: result,
              errorMessage: result === 'FAILED' ? `Action ${auto.actionType} failed` : null,
            },
          })
          executed++
        }
      } catch (err: any) {
        console.error(`[Job:automation] INACTIVE_DAYS ${auto.id} error:`, err?.message ?? err)
      }
    }

    // TASK_OVERDUE: find automations that trigger on overdue tasks
    const overdueAutomations = await prisma.automation.findMany({
      where: { triggerType: 'TASK_OVERDUE', isActive: true },
    })

    for (const auto of overdueAutomations) {
      try {
        const overdueTasks = await prisma.task.findMany({
          where: {
            tenantId: auto.tenantId,
            isDone: false,
            dueDate: { lt: new Date() },
            ...(auto.pipelineId ? { lead: { pipelineId: auto.pipelineId } } : {}),
          },
          select: {
            leadId: true,
            lead: {
              select: {
                id: true, tenantId: true, pipelineId: true, stageId: true,
                responsibleId: true, createdBy: true, name: true, email: true,
                phone: true, whatsapp: true, company: true,
              },
            },
          },
          take: 50,
        })

        const seenLeads = new Set<string>()

        for (const task of overdueTasks) {
          if (seenLeads.has(task.leadId)) continue
          seenLeads.add(task.leadId)

          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const alreadyRan = await prisma.automationLog.findFirst({
            where: {
              automationId: auto.id,
              leadId: task.leadId,
              executedAt: { gte: today },
            },
          })
          if (alreadyRan) continue

          const result = await executeAutomation(auto, task.lead, prisma)
          await prisma.automationLog.create({
            data: {
              tenantId: auto.tenantId,
              automationId: auto.id,
              leadId: task.leadId,
              status: result,
              errorMessage: result === 'FAILED' ? `Action ${auto.actionType} failed` : null,
            },
          })
          executed++
        }
      } catch (err: any) {
        console.error(`[Job:automation] TASK_OVERDUE ${auto.id} error:`, err?.message ?? err)
      }
    }

    const elapsed = Date.now() - start
    if (processed > 0 || executed > 0) {
      console.log(`[Job:automation] ${processed} events processed, ${executed} actions executed (${elapsed}ms)`)
    }
  } catch (error) {
    console.error('[Job:automation] error:', error)
  }
}

/**
 * Check if a trigger's config matches the event payload.
 */
function matchesTrigger(
  triggerType: string,
  triggerConfig: Record<string, any>,
  payload: Record<string, any>,
): boolean {
  switch (triggerType) {
    case 'LEAD_CREATED':
      return true

    case 'STAGE_CHANGED':
      // If triggerConfig.stageId is set, only match that specific stage
      if (triggerConfig.stageId) {
        return triggerConfig.stageId === payload.stageId
      }
      return true

    case 'PRODUCT_ADDED':
      // If triggerConfig.productId is set, only match that product
      if (triggerConfig.productId) {
        return triggerConfig.productId === payload.productId
      }
      return true

    case 'FORM_SUBMITTED':
      if (triggerConfig.formId) {
        return triggerConfig.formId === payload.formId
      }
      return true

    case 'DISCOUNT_REQUESTED':
      return true

    case 'REPEAT_PURCHASE':
      return true

    default:
      return true
  }
}
