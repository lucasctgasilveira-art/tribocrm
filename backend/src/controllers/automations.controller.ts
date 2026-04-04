import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export async function getAutomations(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId

    const automations = await prisma.automation.findMany({
      where: { tenantId },
      include: {
        pipeline: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })

    const activeCount = automations.filter(a => a.isActive).length
    const pausedCount = automations.filter(a => !a.isActive).length

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const executionsThisMonth = await prisma.automationLog.count({
      where: {
        tenantId,
        executedAt: { gte: startOfMonth },
      },
    })

    res.json({
      success: true,
      data: automations,
      meta: { activeCount, pausedCount, executionsThisMonth },
    })
  } catch (error) {
    console.error('[Automations] getAutomations error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createAutomation(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId

    const { name, pipelineId, triggerType, triggerConfig, actionType, actionConfig } = req.body

    if (!name || !triggerType || !actionType) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name, triggerType e actionType são obrigatórios' },
      })
      return
    }

    const automation = await prisma.automation.create({
      data: {
        tenantId,
        pipelineId: pipelineId || null,
        name,
        triggerType: triggerType as 'STAGE_CHANGED' | 'INACTIVE_DAYS' | 'TASK_OVERDUE' | 'LEAD_CREATED' | 'PRODUCT_ADDED' | 'GOAL_REACHED' | 'FORM_SUBMITTED',
        triggerConfig: triggerConfig ?? {},
        actionType: actionType as 'SEND_WHATSAPP' | 'SEND_EMAIL' | 'CREATE_TASK' | 'MOVE_STAGE' | 'NOTIFY_USER' | 'DUPLICATE_LEAD' | 'MOVE_TO_PIPELINE',
        actionConfig: actionConfig ?? {},
        createdBy: userId,
      },
      include: {
        pipeline: { select: { id: true, name: true } },
      },
    })

    res.status(201).json({ success: true, data: automation })
  } catch (error) {
    console.error('[Automations] createAutomation error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateAutomation(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.automation.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Automação não encontrada' },
      })
      return
    }

    const { name, pipelineId, triggerType, triggerConfig, actionType, actionConfig, isActive } = req.body

    const data: Prisma.AutomationUpdateInput = {}
    if (name !== undefined) data.name = name
    if (pipelineId !== undefined) data.pipeline = pipelineId ? { connect: { id: pipelineId } } : { disconnect: true }
    if (triggerType !== undefined) data.triggerType = triggerType
    if (triggerConfig !== undefined) data.triggerConfig = triggerConfig
    if (actionType !== undefined) data.actionType = actionType
    if (actionConfig !== undefined) data.actionConfig = actionConfig
    if (isActive !== undefined) data.isActive = isActive

    const automation = await prisma.automation.update({
      where: { id },
      data,
      include: {
        pipeline: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: automation })
  } catch (error) {
    console.error('[Automations] updateAutomation error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteAutomation(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.automation.findFirst({ where: { id, tenantId } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Automação não encontrada' },
      })
      return
    }

    await prisma.automation.update({ where: { id }, data: { isActive: false } })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Automations] deleteAutomation error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getAutomationLogs(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const automation = await prisma.automation.findFirst({ where: { id, tenantId } })
    if (!automation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Automação não encontrada' },
      })
      return
    }

    const logs = await prisma.automationLog.findMany({
      where: { automationId: id, tenantId },
      orderBy: { executedAt: 'desc' },
      take: 50,
    })

    res.json({ success: true, data: logs })
  } catch (error) {
    console.error('[Automations] getAutomationLogs error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
