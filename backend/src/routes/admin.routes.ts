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

// ── Retry Charge ──

router.post('/charges/:id/retry', async (req: Request, res: Response) => {
  try {
    const charge = await prisma.charge.findUnique({
      where: { id: req.params.id as string },
      include: { tenant: true },
    })
    if (!charge) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cobrança não encontrada' } }); return }

    const { paymentMethod } = req.body
    const value = Number(charge.amount)
    const desc = `Cobrança ${charge.referenceMonth ?? ''} — ${charge.tenant.name}`

    if (paymentMethod === 'PIX') {
      const { createPixCharge } = await import('../services/efi.service')
      const result = await createPixCharge(charge.tenantId, { value, description: desc, debtorName: charge.tenant.name, debtorCpf: charge.tenant.cnpj.replace(/\D/g, '') })
      res.json({ success: true, data: result })
    } else {
      const { createBoletoCharge } = await import('../services/efi.service')
      const dueDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
      const result = await createBoletoCharge(charge.tenantId, { value, description: desc, dueDate, debtorName: charge.tenant.name, debtorCpf: charge.tenant.cnpj.replace(/\D/g, ''), debtorEmail: charge.tenant.email, debtorStreet: 'N/A', debtorCity: 'São Paulo', debtorState: 'SP', debtorZipCode: '01000000' })
      res.json({ success: true, data: result })
    }
  } catch (error: any) {
    console.error('[Admin] retry charge error:', error.message)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

export default router
