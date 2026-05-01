import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { getPipelines, getKanban, createPipeline, updatePipeline } from '../controllers/pipeline.controller'
import { prisma } from '../lib/prisma'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', getPipelines)
router.get('/:id/kanban', getKanban)
router.post('/', createPipeline)
router.patch('/:id', updatePipeline)

/**
 * GET /pipelines/:pipelineId/stages
 *
 * Retorna as stages do pipeline ordenadas por sortOrder.
 * Filtra ativas por padrao (isActive=true). Inclui stages fixas
 * (WON/LOST) — necessarias pra extensao Chrome resolver "Marcar
 * venda/perda" sem listar o pipeline inteiro.
 *
 * Por que existir, ja que o GET /pipelines /:id/kanban e GET /pipelines
 * tambem trazem stages embutidas?
 *   A extensao Chrome ja tinha contrato com esse endpoint dedicado
 *   (extension/src/shared/api/leads.service.ts:57). Sem ele, o handler
 *   resolveOutcomeStage caia em 404 silencioso e o "Marcar venda" nao
 *   persistia. Endpoint dedicado tambem e mais barato — sem JOIN com
 *   leads (kanban) nem retorno de toda a lista de pipelines.
 */
router.get('/:pipelineId/stages', async (req: Request, res: Response) => {
  try {
    const pipelineId = req.params.pipelineId as string
    const tenantId = req.user!.tenantId

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId, isActive: true },
      select: { id: true },
    })
    if (!pipeline) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pipeline nao encontrado' },
      })
      return
    }

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId, tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        type: true,
        sortOrder: true,
        isFixed: true,
      },
    })

    res.json({ success: true, data: stages })
  } catch (error: any) {
    console.error('[Pipelines] getStages error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

/**
 * PUT /pipelines/:pipelineId/stages
 *
 * Bulk replace of the pipeline's stages, used by the gestor's
 * Configurações → Pipeline screen "Salvar etapas" button.
 *
 * Body: { stages: [{ id?, name, color, sortOrder }] }
 *
 * Semantics:
 *   - Stage with id matching an existing row → name/color/sortOrder updated
 *   - Stage with no id → new row created (NORMAL type, isFixed=false)
 *   - Existing rows missing from the payload → DELETED (only when not
 *     fixed AND not referenced by any lead). Refusal returns 409 with
 *     the offending stage so the UI can surface it instead of silently
 *     keeping the row.
 *
 * Fixed stages (Venda Realizada, Perdido) are never touched by the
 * delete pass even if absent from the payload — the frontend may
 * choose not to ship them; the server preserves them either way.
 */
router.put('/:pipelineId/stages', async (req: Request, res: Response) => {
  const pipelineId = req.params.pipelineId as string
  try {
    const tenantId = req.user!.tenantId
    const body = req.body as { stages?: { id?: string; name?: string; color?: string; sortOrder?: number; isActive?: boolean }[] }

    if (!Array.isArray(body?.stages)) {
      console.warn('[Pipelines] bulk save 400 — stages not array', { tenantId, pipelineId, bodyType: typeof body?.stages })
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'stages é obrigatório (array)' },
      })
      return
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
      include: { stages: true },
    })
    if (!pipeline) {
      console.warn('[Pipelines] bulk save 404 — pipeline not found in tenant', { tenantId, pipelineId })
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pipeline não encontrado' },
      })
      return
    }

    const existingById = new Map(pipeline.stages.map(s => [s.id, s]))
    const incoming = body.stages

    // Normalize each incoming entry; reject empty names early
    for (const s of incoming) {
      if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Toda etapa precisa de um nome' },
        })
        return
      }
    }

    const incomingIds = new Set(incoming.map(s => s.id).filter((x): x is string => typeof x === 'string'))

    // Delete pass: any non-fixed existing stage missing from the
    // payload gets removed, but only when no lead is sitting on it.
    const toDelete = pipeline.stages.filter(s => !s.isFixed && !incomingIds.has(s.id))
    for (const s of toDelete) {
      const leadCount = await prisma.lead.count({ where: { stageId: s.id, tenantId, deletedAt: null } })
      if (leadCount > 0) {
        res.status(409).json({
          success: false,
          error: {
            code: 'STAGE_HAS_LEADS',
            message: `A etapa "${s.name}" tem ${leadCount} lead(s) e não pode ser removida. Mova-os antes.`,
          },
        })
        return
      }
    }

    await prisma.$transaction(async (tx) => {
      // Delete first so name/sortOrder ordering doesn't race with the
      // updates below.
      if (toDelete.length > 0) {
        await tx.pipelineStage.deleteMany({ where: { id: { in: toDelete.map(s => s.id) } } })
      }

      for (let i = 0; i < incoming.length; i++) {
        const s = incoming[i]!
        const desiredOrder = typeof s.sortOrder === 'number' ? s.sortOrder : i
        const color = (typeof s.color === 'string' && /^#([0-9a-f]{3}){1,2}$/i.test(s.color)) ? s.color : '#6b7280'
        const name = s.name!.trim().slice(0, 100)

        if (s.id && existingById.has(s.id)) {
          const existing = existingById.get(s.id)!
          // Fixed stages: name and color CAN be renamed/recolored by
          // the gestor (per Configurações spec — Venda Realizada and
          // Perdido stay fixed in role/position but their label is
          // editable). isActive is forced to true for fixed stages so
          // the gestor can never accidentally turn off a terminal
          // state needed by the kanban / WON/LOST lead flows.
          await tx.pipelineStage.update({
            where: { id: s.id },
            data: {
              name,
              color,
              sortOrder: desiredOrder,
              isActive: existing.isFixed ? true : (typeof s.isActive === 'boolean' ? s.isActive : true),
            },
          })
        } else {
          await tx.pipelineStage.create({
            data: {
              tenantId,
              pipelineId,
              name,
              color,
              type: 'NORMAL',
              sortOrder: desiredOrder,
              isFixed: false,
              isActive: typeof s.isActive === 'boolean' ? s.isActive : true,
            },
          })
        }
      }
    })

    const fresh = await prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, color: true, type: true, sortOrder: true, isFixed: true, isActive: true },
    })

    res.json({ success: true, data: fresh })
  } catch (error: any) {
    // Verbose diagnostics: surface Prisma error code, full message,
    // stack and the offending pipelineId/payload so the next failure
    // is debuggable from logs alone.
    const safeBody = (() => {
      try { return JSON.stringify(req.body).slice(0, 1000) } catch { return '[unserializable]' }
    })()
    console.error('[Pipelines] bulk stages save FAILED', {
      pipelineId,
      tenantId: req.user?.tenantId,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      body: safeBody,
      stack: error?.stack,
    })
    res.status(500).json({
      success: false,
      error: { code: error?.code ?? 'INTERNAL_ERROR', message: error?.message ?? 'Erro interno do servidor' },
    })
  }
})

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
