import { prisma } from '../lib/prisma'

/**
 * Every 5 minutes — automation engine.
 * SKELETON: lists active automations per tenant and logs the count.
 * Actual trigger evaluation and action execution will be implemented later.
 */
export async function runAutomationJob(): Promise<void> {
  const start = Date.now()
  try {
    const automations = await prisma.automation.findMany({
      where: { isActive: true },
      select: { id: true, tenantId: true, name: true, triggerType: true, actionType: true },
    })

    // Group by tenant for the log
    const byTenant = new Map<string, number>()
    for (const a of automations) {
      byTenant.set(a.tenantId, (byTenant.get(a.tenantId) ?? 0) + 1)
    }

    console.log(`[Job:automation] processando ${automations.length} automações em ${byTenant.size} tenants (${Date.now() - start}ms)`)
    // TODO: evaluate triggers (STAGE_CHANGED, INACTIVE_DAYS, LEAD_CREATED, etc.)
    //       and execute actions (SEND_WHATSAPP, SEND_EMAIL, CREATE_TASK, etc.)
  } catch (error) {
    console.error('[Job:automation] error:', error)
  }
}
