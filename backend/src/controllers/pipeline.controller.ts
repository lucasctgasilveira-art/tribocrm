import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export async function getPipelines(req: Request, res: Response): Promise<void> {
  try {
    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId: req.user!.tenantId, isActive: true },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })

    res.json({ success: true, data: pipelines })
  } catch (error) {
    console.error('[Pipeline] getPipelines error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getKanban(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string

    const pipeline = await prisma.pipeline.findFirst({
      where: { id, tenantId: req.user!.tenantId, isActive: true },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!pipeline) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pipeline não encontrado' },
      })
      return
    }

    const stagesWithLeads = await Promise.all(
      pipeline.stages.map(async (stage: typeof pipeline.stages[number]) => {
        const leads = await prisma.lead.findMany({
          where: { stageId: stage.id, tenantId: req.user!.tenantId, status: 'ACTIVE', deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            whatsapp: true,
            expectedValue: true,
            temperature: true,
            stageId: true,
            lastActivityAt: true,
            responsible: { select: { id: true, name: true } },
          },
        })

        return {
          id: stage.id,
          name: stage.name,
          color: stage.color,
          position: stage.sortOrder,
          leads,
        }
      }),
    )

    res.json({
      success: true,
      data: {
        pipeline: { id: pipeline.id, name: pipeline.name },
        stages: stagesWithLeads,
      },
    })
  } catch (error) {
    console.error('[Pipeline] getKanban error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

const DEFAULT_STAGES = [
  { name: 'Sem Contato', color: '#6b7280', type: 'NORMAL' as const, isFixed: false },
  { name: 'Em Contato', color: '#3b82f6', type: 'NORMAL' as const, isFixed: false },
  { name: 'Negociando', color: '#f59e0b', type: 'NORMAL' as const, isFixed: false },
  { name: 'Proposta Enviada', color: '#8b5cf6', type: 'NORMAL' as const, isFixed: false },
  { name: 'Venda Realizada', color: '#22c55e', type: 'WON' as const, isFixed: true },
  { name: 'Repescagem', color: '#f97316', type: 'REACTIVATION' as const, isFixed: false },
  { name: 'Perdido', color: '#ef4444', type: 'LOST' as const, isFixed: true },
]

export async function createPipeline(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.body
    const tenantId = req.user!.tenantId

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nome do pipeline é obrigatório' },
      })
      return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    })

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' },
      })
      return
    }

    const currentCount = await prisma.pipeline.count({
      where: { tenantId, isActive: true },
    })

    if (currentCount >= tenant.plan.maxPipelines) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PLAN_LIMIT',
          message: `Limite de ${tenant.plan.maxPipelines} pipeline(s) atingido no plano ${tenant.plan.name}`,
        },
      })
      return
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        tenantId,
        name: name.trim(),
        isDefault: currentCount === 0,
        stages: {
          create: DEFAULT_STAGES.map((stage, index) => ({
            tenantId,
            name: stage.name,
            color: stage.color,
            type: stage.type,
            sortOrder: index,
            isFixed: stage.isFixed,
          })),
        },
      },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })

    res.status(201).json({ success: true, data: pipeline })
  } catch (error) {
    console.error('[Pipeline] createPipeline error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
