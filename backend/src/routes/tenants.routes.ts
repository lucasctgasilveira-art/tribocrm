import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { prisma } from '../lib/prisma'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

/**
 * PATCH /tenants/onboarding
 *
 * Updates the first-access wizard state on the authenticated user's
 * tenant. Only MANAGER/OWNER roles can write these fields — sellers
 * and admins must not be able to flip another tenant's flag.
 *
 * Body: { step?: number; completed?: boolean }
 *   - step:        clamped to [0, 3]
 *   - completed:   when true, also sets step=3 for consistency
 *
 * Returns the fresh { onboardingStep, onboardingCompleted } pair so the
 * frontend can update its local copy in one round-trip.
 */
router.patch('/onboarding', async (req: Request, res: Response) => {
  try {
    const role = req.user!.role
    if (role !== 'MANAGER' && role !== 'OWNER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Apenas gestor pode alterar o onboarding do tenant' },
      })
      return
    }

    const tenantId = req.user!.tenantId
    if (tenantId === 'platform') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TENANT', message: 'Super Admin não tem onboarding de tenant' },
      })
      return
    }

    const { step, completed } = req.body as { step?: number; completed?: boolean }

    const data: { onboardingStep?: number; onboardingCompleted?: boolean } = {}
    if (typeof step === 'number') {
      data.onboardingStep = Math.max(0, Math.min(3, Math.trunc(step)))
    }
    if (typeof completed === 'boolean') {
      data.onboardingCompleted = completed
      if (completed) data.onboardingStep = 3
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'step ou completed é obrigatório' },
      })
      return
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { onboardingStep: true, onboardingCompleted: true },
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Tenants] onboarding update error:', error?.message ?? error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
})

export default router
