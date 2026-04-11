import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getPipelines, getKanban, createPipeline, updatePipeline } from '../controllers/pipeline.controller'
import { prisma } from '../lib/prisma'

const router = Router()

router.use(authMiddleware)

router.get('/', getPipelines)
router.get('/:id/kanban', getKanban)
router.post('/', createPipeline)
router.patch('/:id', updatePipeline)

/**
 * PATCH /pipelines/:pipelineId/stages/:stageId { name }
 *
 * Renames a non-fixed pipeline stage. Fixed stages (Venda Realizada,
 * Perdido) can't be renamed — they're system-owned. Used by the
 * OnboardingWizard step 1 ("Configure seu pipeline").
 */
router.patch('/:pipelineId/stages/:stageId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const pipelineId = req.params.pipelineId as string
    const stageId = req.params.stageId as string
    const { name } = req.body as { name?: string }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' },
      })
      return
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, tenantId },
    })
    if (!stage) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Etapa não encontrada' },
      })
      return
    }
    if (stage.isFixed) {
      res.status(400).json({
        success: false,
        error: { code: 'STAGE_FIXED', message: 'Etapas fixas do sistema não podem ser renomeadas' },
      })
      return
    }

    const updated = await prisma.pipelineStage.update({
      where: { id: stageId },
      data: { name: name.trim().slice(0, 100) },
      select: { id: true, name: true, color: true, type: true, sortOrder: true, isFixed: true },
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Pipelines] stage rename error:', error?.message ?? error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
})

export default router
