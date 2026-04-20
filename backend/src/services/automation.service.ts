import type { PrismaClient } from '@prisma/client'
import { sendMail } from './mailer.service'

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface AutomationRecord {
  id: string
  tenantId: string
  actionType: string
  actionConfig: any
}

interface LeadRecord {
  id: string
  tenantId: string
  pipelineId: string
  stageId: string
  responsibleId: string
  createdBy: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  company: string | null
}

type ActionResult = 'SUCCESS' | 'FAILED' | 'SKIPPED'

/**
 * Replace template variables in a string.
 * Supported: {{nome_lead}}, {{empresa_lead}}, {{nome_vendedor}}, {{nome_empresa}}
 */
async function replaceVars(
  text: string,
  lead: LeadRecord,
  tx: TxClient,
): Promise<string> {
  let result = text
  result = result.replace(/\{\{nome_lead\}\}/g, lead.name)
  result = result.replace(/\{\{empresa_lead\}\}/g, lead.company ?? '')

  if (result.includes('{{nome_vendedor}}')) {
    const user = await tx.user.findUnique({ where: { id: lead.responsibleId }, select: { name: true } })
    result = result.replace(/\{\{nome_vendedor\}\}/g, user?.name ?? '')
  }

  if (result.includes('{{nome_empresa}}')) {
    const tenant = await tx.tenant.findUnique({ where: { id: lead.tenantId }, select: { name: true } })
    result = result.replace(/\{\{nome_empresa\}\}/g, tenant?.name ?? '')
  }

  return result
}

// ── Action Handlers ──

async function handleSendEmail(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  if (!lead.email) return 'SKIPPED'

  const config = automation.actionConfig as { templateId?: string; subject?: string }
  if (!config.templateId) return 'FAILED'

  const template = await tx.emailTemplate.findFirst({
    where: { id: config.templateId, tenantId: automation.tenantId, isActive: true },
  })
  if (!template) return 'FAILED'

  const subject = await replaceVars(config.subject || template.subject, lead, tx)
  const body = await replaceVars(template.body, lead, tx)

  const result = await sendMail({
    to: lead.email,
    subject,
    text: body.replace(/<[^>]*>/g, ''),
    html: body,
    tenantId: automation.tenantId,
  })

  if (!result.sent) return 'FAILED'

  await tx.interaction.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      userId: lead.responsibleId,
      type: 'EMAIL',
      content: `[Automação] E-mail enviado: ${subject}`,
      isAuto: true,
    },
  })

  return 'SUCCESS'
}

async function handleCreateTask(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  const config = automation.actionConfig as { title?: string; taskType?: string; daysFromNow?: number }
  if (!config.title || !config.taskType) return 'FAILED'

  const rawTitle = await replaceVars(config.title, lead, tx)
  // Mirrors the `[Automação] ` prefix pattern already used on every
  // interaction.create call in this file, so automation-owned tasks
  // are immediately distinguishable in the list view. Guard against
  // double-prefixing if the automation author already typed it.
  const title = rawTitle.startsWith('[Automação]') ? rawTitle : `[Automação] ${rawTitle}`
  const dueDate = config.daysFromNow != null
    ? new Date(Date.now() + config.daysFromNow * 86_400_000)
    : null

  await tx.task.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      responsibleId: lead.responsibleId,
      createdBy: lead.responsibleId,
      type: config.taskType as any,
      title,
      dueDate,
    },
  })

  return 'SUCCESS'
}

async function handleMoveStage(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  const config = automation.actionConfig as { stageId?: string }
  if (!config.stageId) return 'FAILED'

  const stage = await tx.pipelineStage.findFirst({
    where: { id: config.stageId, pipelineId: lead.pipelineId, tenantId: lead.tenantId },
    select: { id: true, name: true },
  })
  if (!stage) return 'FAILED'

  if (lead.stageId === config.stageId) return 'SKIPPED'

  await tx.lead.update({
    where: { id: lead.id },
    data: { stageId: config.stageId },
  })

  await tx.interaction.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      userId: lead.responsibleId,
      type: 'SYSTEM',
      content: `[Automação] Movido automaticamente para "${stage.name}"`,
      isAuto: true,
    },
  })

  return 'SUCCESS'
}

async function handleNotifyUser(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  const config = automation.actionConfig as { message?: string; targetRole?: string }
  if (!config.message) return 'FAILED'

  const message = await replaceVars(config.message, lead, tx)
  const userIds: string[] = []

  if (config.targetRole === 'MANAGER') {
    const managers = await tx.user.findMany({
      where: { tenantId: lead.tenantId, role: { in: ['OWNER', 'MANAGER'] }, isActive: true, deletedAt: null },
      select: { id: true },
    })
    userIds.push(...managers.map(m => m.id))
  } else {
    // Default: RESPONSIBLE
    userIds.push(lead.responsibleId)
  }

  if (userIds.length === 0) return 'SKIPPED'

  await tx.notification.createMany({
    data: userIds.map(userId => ({
      tenantId: lead.tenantId,
      userId,
      type: 'AUTOMATION' as any,
      title: `Automação: ${lead.name}`,
      body: message,
      link: `/leads/${lead.id}`,
    })),
  })

  return 'SUCCESS'
}

async function handleDuplicateLead(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  const config = automation.actionConfig as { targetPipelineId?: string; targetStageId?: string }
  if (!config.targetPipelineId || !config.targetStageId) return 'FAILED'

  const stage = await tx.pipelineStage.findFirst({
    where: { id: config.targetStageId, pipelineId: config.targetPipelineId, tenantId: lead.tenantId },
    select: { id: true, name: true },
  })
  if (!stage) return 'FAILED'

  const pipeline = await tx.pipeline.findFirst({
    where: { id: config.targetPipelineId, tenantId: lead.tenantId },
    select: { name: true },
  })

  const duplicate = await tx.lead.create({
    data: {
      tenantId: lead.tenantId,
      pipelineId: config.targetPipelineId,
      stageId: config.targetStageId,
      responsibleId: lead.responsibleId,
      createdBy: lead.createdBy,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      company: lead.company,
      status: 'ACTIVE',
    },
  })

  const pipelineName = pipeline?.name ?? config.targetPipelineId

  await tx.interaction.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      userId: lead.responsibleId,
      type: 'SYSTEM',
      content: `[Automação] Lead duplicado para pipeline "${pipelineName}"`,
      isAuto: true,
    },
  })

  await tx.interaction.create({
    data: {
      tenantId: lead.tenantId,
      leadId: duplicate.id,
      userId: lead.responsibleId,
      type: 'SYSTEM',
      content: `[Automação] Duplicado a partir do lead "${lead.name}"`,
      isAuto: true,
    },
  })

  return 'SUCCESS'
}

async function handleMoveToPipeline(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  const config = automation.actionConfig as { targetPipelineId?: string; targetStageId?: string }
  if (!config.targetPipelineId || !config.targetStageId) return 'FAILED'

  const stage = await tx.pipelineStage.findFirst({
    where: { id: config.targetStageId, pipelineId: config.targetPipelineId, tenantId: lead.tenantId },
    select: { id: true, name: true },
  })
  if (!stage) return 'FAILED'

  const pipeline = await tx.pipeline.findFirst({
    where: { id: config.targetPipelineId, tenantId: lead.tenantId },
    select: { name: true },
  })

  if (lead.pipelineId === config.targetPipelineId && lead.stageId === config.targetStageId) return 'SKIPPED'

  await tx.lead.update({
    where: { id: lead.id },
    data: { pipelineId: config.targetPipelineId, stageId: config.targetStageId },
  })

  await tx.interaction.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      userId: lead.responsibleId,
      type: 'SYSTEM',
      content: `[Automação] Movido para pipeline "${pipeline?.name ?? ''}" → etapa "${stage.name}"`,
      isAuto: true,
    },
  })

  return 'SUCCESS'
}

async function handleSendWhatsapp(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  if (!lead.whatsapp) return 'SKIPPED'

  const config = automation.actionConfig as { templateId?: string }
  if (!config.templateId) return 'FAILED'

  const template = await tx.whatsappTemplate.findFirst({
    where: { id: config.templateId, tenantId: automation.tenantId, isActive: true },
  })
  if (!template) return 'FAILED'

  const body = await replaceVars(template.body, lead, tx)

  await tx.scheduledMessage.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      userId: lead.responsibleId,
      templateId: config.templateId,
      messageBody: body,
      scheduledAt: new Date(),
      status: 'PENDING',
    },
  })

  return 'SUCCESS'
}

// ── Main Executor ──

const ACTION_HANDLERS: Record<string, (a: AutomationRecord, l: LeadRecord, tx: TxClient) => Promise<ActionResult>> = {
  SEND_EMAIL: handleSendEmail,
  CREATE_TASK: handleCreateTask,
  MOVE_STAGE: handleMoveStage,
  NOTIFY_USER: handleNotifyUser,
  DUPLICATE_LEAD: handleDuplicateLead,
  MOVE_TO_PIPELINE: handleMoveToPipeline,
  SEND_WHATSAPP: handleSendWhatsapp,
}

export async function executeAutomation(
  automation: AutomationRecord,
  lead: LeadRecord,
  tx: TxClient,
): Promise<ActionResult> {
  const handler = ACTION_HANDLERS[automation.actionType]
  if (!handler) {
    console.warn(`[Automation] Unknown action type: ${automation.actionType}`)
    return 'SKIPPED'
  }

  try {
    return await handler(automation, lead, tx)
  } catch (err: any) {
    console.error(`[Automation] ${automation.actionType} failed for lead ${lead.id}:`, err?.message ?? err)
    return 'FAILED'
  }
}
