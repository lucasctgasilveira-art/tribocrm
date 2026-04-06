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

// ── Coupons ──

router.get('/coupons', async (_req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: coupons.map(c => ({ ...c, discountValue: Number(c.discountValue) })) })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.post('/coupons', async (req: Request, res: Response) => {
  try {
    const { code, description, discountType, discountValue, applicablePlans, maxUses, maxUsesPerUser, validFrom, validUntil, durationType, durationMonths } = req.body
    const coupon = await prisma.coupon.create({
      data: { code: code.toUpperCase(), description, discountType, discountValue, applicablePlans: applicablePlans ?? [], maxUses, maxUsesPerUser: maxUsesPerUser ?? 1, validFrom: validFrom ? new Date(validFrom) : new Date(), validUntil: validUntil ? new Date(validUntil) : null, durationType: durationType ?? 'FIRST', durationMonths, createdBy: req.user!.userId },
    })
    res.json({ success: true, data: { ...coupon, discountValue: Number(coupon.discountValue) } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/coupons/:id', async (req: Request, res: Response) => {
  try {
    const data: Record<string, unknown> = {}
    const { description, discountType, discountValue, applicablePlans, maxUses, maxUsesPerUser, validUntil, durationType, durationMonths, isActive } = req.body
    if (description !== undefined) data.description = description
    if (discountType) data.discountType = discountType
    if (discountValue !== undefined) data.discountValue = discountValue
    if (applicablePlans) data.applicablePlans = applicablePlans
    if (maxUses !== undefined) data.maxUses = maxUses
    if (maxUsesPerUser !== undefined) data.maxUsesPerUser = maxUsesPerUser
    if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null
    if (durationType) data.durationType = durationType
    if (durationMonths !== undefined) data.durationMonths = durationMonths
    if (isActive !== undefined) data.isActive = isActive
    const coupon = await prisma.coupon.update({ where: { id: req.params.id as string }, data })
    res.json({ success: true, data: { ...coupon, discountValue: Number(coupon.discountValue) } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.delete('/coupons/:id', async (req: Request, res: Response) => {
  try {
    await prisma.coupon.update({ where: { id: req.params.id as string }, data: { isActive: false } })
    res.json({ success: true })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

// ── Tenant Discount ──

router.post('/tenants/:id/discount', async (req: Request, res: Response) => {
  try {
    const { discountType, discountValue, discountCycles, discountReason, applyImmediately } = req.body
    const data: Record<string, unknown> = { discountType, discountValue, discountCycles, discountReason, discountFrom: applyImmediately ? new Date() : null }
    const tenant = await prisma.tenant.update({ where: { id: req.params.id as string }, data })
    res.json({ success: true, data: tenant })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
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

// ── Internal Team ──

router.get('/team', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })) })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.post('/team', async (req: Request, res: Response) => {
  try {
    const { name, email, role, password } = req.body
    if (!name || !email || !role || !password) { res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Campos obrigatórios: name, email, role, password' } }); return }
    const exists = await prisma.adminUser.findUnique({ where: { email } })
    if (exists) { res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Já existe um membro com este e-mail' } }); return }
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.default.hash(password, 10)
    const user = await prisma.adminUser.create({ data: { name, email, passwordHash, role } })
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/team/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (role !== undefined) data.role = role
    const user = await prisma.adminUser.update({ where: { id: req.params.id as string }, data })
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/team/:id/status', async (req: Request, res: Response) => {
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: req.params.id as string } })
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Membro não encontrado' } }); return }
    const updated = await prisma.adminUser.update({ where: { id: req.params.id as string }, data: { isActive: !user.isActive } })
    res.json({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive, lastLoginAt: updated.lastLoginAt, createdAt: updated.createdAt } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/team/:id/password', async (req: Request, res: Response) => {
  try {
    const { password } = req.body
    if (!password) { res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Senha é obrigatória' } }); return }
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.default.hash(password, 10)
    await prisma.adminUser.update({ where: { id: req.params.id as string }, data: { passwordHash } })
    res.json({ success: true })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.get('/team/:id/permissions', async (req: Request, res: Response) => {
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: req.params.id as string }, select: { id: true, permissions: true, role: true } })
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Membro não encontrado' } }); return }
    res.json({ success: true, data: { id: user.id, role: user.role, permissions: user.permissions } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/team/:id/permissions', async (req: Request, res: Response) => {
  try {
    const { permissions } = req.body
    const user = await prisma.adminUser.update({ where: { id: req.params.id as string }, data: { permissions } })
    res.json({ success: true, data: { id: user.id, role: user.role, permissions: user.permissions } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

export default router
