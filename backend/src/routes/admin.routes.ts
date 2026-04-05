import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { adminOnly } from '../middleware/admin.middleware'
import { prisma } from '../lib/prisma'
import {
  getAdminDashboard, getTenants, getTenant, updateTenant, getFinancial,
} from '../controllers/admin.controller'

const router = Router()

router.use(authMiddleware)
router.use(adminOnly)

router.get('/dashboard', getAdminDashboard)
router.get('/tenants', getTenants)
router.get('/tenants/:id', getTenant)
router.patch('/tenants/:id', updateTenant)
router.get('/financial', getFinancial)

// ── Plans ──

router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } })
    const plansWithCounts = await Promise.all(plans.map(async p => {
      const tenantCount = await prisma.tenant.count({ where: { planId: p.id } })
      return { ...p, priceMonthly: Number(p.priceMonthly), priceYearly: Number(p.priceYearly), extraUserPrice: Number(p.extraUserPrice), tenantCount }
    }))
    res.json({ success: true, data: plansWithCounts })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.patch('/plans/:id/price', async (req: Request, res: Response) => {
  try {
    const { priceMonthly, priceYearly } = req.body
    const updated = await prisma.plan.update({
      where: { id: req.params.id as string },
      data: {
        ...(priceMonthly !== undefined ? { priceMonthly } : {}),
        ...(priceYearly !== undefined ? { priceYearly } : {}),
      },
    })
    res.json({ success: true, data: { ...updated, priceMonthly: Number(updated.priceMonthly), priceYearly: Number(updated.priceYearly) } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

export default router
