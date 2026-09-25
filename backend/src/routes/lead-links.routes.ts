import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { sellerScope } from '../controllers/leads.controller'
import { prisma } from '../lib/prisma'

const router = Router()
router.use(authMiddleware)
router.use(tenantStatusGuard)

// GET /lead-links/:leadId
//
// Outros cards ATIVOS da mesma pessoa (mesmo e-mail, case-insensitive)
// no tenant — usado pelo bloco "Também está em" do LeadDrawer. Devolve
// só pipeline/etapa/responsável (nada de valores, contato ou histórico).
// O acesso ao lead de origem respeita o sellerScope; os cards
// relacionados são apenas informativos (o front não linka pra eles).
router.get('/:leadId', async (req: Request, res: Response) => {
  try {
    const leadId = req.params.leadId as string
    if (!z.string().uuid().safeParse(leadId).success) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }
    const { tenantId, role, userId } = req.user!

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true, email: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }

    const email = lead.email?.trim()
    if (!email) {
      res.json({ success: true, data: [] })
      return
    }

    const related = await prisma.lead.findMany({
      where: {
        tenantId,
        id: { not: lead.id },
        email: { equals: email, mode: 'insensitive' },
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        pipeline: { select: { name: true } },
        stage: { select: { name: true, color: true } },
        responsible: { select: { name: true } },
      },
    })

    res.json({
      success: true,
      data: related.map(r => ({
        id: r.id,
        pipelineName: r.pipeline.name,
        stageName: r.stage.name,
        stageColor: r.stage.color,
        responsibleName: r.responsible.name,
      })),
    })
  } catch (error: any) {
    console.error('[LeadLinks] error:', error?.message ?? error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } })
  }
})

export default router
