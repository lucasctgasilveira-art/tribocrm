import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { login, refresh, logout } from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const router = Router()

router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)

// GET /auth/me
//
// Returns the authenticated user + tenant + plan snapshot. Used by
// gestor-side screens (e.g. Assinatura) that need to know the
// subscription state without hitting multiple endpoints. SUPER_ADMIN
// callers return `tenant: null` and `plan: null` because they live in
// admin_users with no tenant anchor.
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, tenantId, role } = req.user!

    if (role === 'SUPER_ADMIN' || tenantId === 'platform') {
      res.json({
        success: true,
        data: {
          user: { id: userId, role, tenantId },
          tenant: null,
          plan: null,
        },
      })
      return
    }

    const [user, tenant] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, tenantId: true, avatarUrl: true },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: { select: { id: true, slug: true, name: true, priceMonthly: true, priceYearly: true } } },
      }),
    ])

    if (!user || !tenant) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário ou tenant não encontrado' } })
      return
    }

    res.json({
      success: true,
      data: {
        user,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          tradeName: tenant.tradeName,
          status: tenant.status,
          planCycle: tenant.planCycle,
          trialEndsAt: tenant.trialEndsAt,
          planExpiresAt: tenant.planExpiresAt,
          planStartedAt: tenant.planStartedAt,
        },
        plan: {
          id: tenant.plan.id,
          slug: tenant.plan.slug,
          name: tenant.plan.name,
          priceMonthly: Number(tenant.plan.priceMonthly),
          priceYearly: Number(tenant.plan.priceYearly),
        },
      },
    })
  } catch (error: any) {
    console.error('[Auth] /me error:', error?.message ?? error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } })
  }
})

router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Senha atual e nova senha sao obrigatorias' } })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, passwordHash: true } })
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuario nao encontrado' } }); return }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) { res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Senha atual incorreta' } }); return }

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })

    res.json({ success: true, data: { message: 'Senha alterada com sucesso' } })
  } catch (error: any) {
    console.error('[Auth] change-password error:', error.message)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } })
  }
})

export default router
