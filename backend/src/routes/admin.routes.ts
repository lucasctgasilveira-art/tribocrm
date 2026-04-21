import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { adminOnly } from '../middleware/admin.middleware'
import { prisma } from '../lib/prisma'
import {
  getAdminDashboard, getTenants, getTenant, updateTenant, getFinancial,
} from '../controllers/admin.controller'
import { registerPixWebhook, createPixCharge, createBoletoCharge } from '../services/efi.service'
import { sendMail } from '../services/mailer.service'
import { runBillingStateMachineJob } from '../jobs/billing-state-machine.job'
import {
  resolveCampaignRecipients,
  type CampaignFilters,
  type CampaignAudience,
} from '../services/campaigns.service'

function generateTempPassword(): string {
  const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += pool[Math.floor(Math.random() * pool.length)]
  return pwd
}

const router = Router()

router.use(authMiddleware)
router.use(adminOnly)

router.get('/dashboard', getAdminDashboard)
router.get('/tenants', getTenants)
router.get('/tenants/:id', getTenant)
router.patch('/tenants/:id', updateTenant)

router.post('/tenants', async (req: Request, res: Response) => {
  try {
    const {
      name, tradeName, cnpj, email, phone, planId, planCycle,
      site, responsibleName, foundedAt, address,
    } = req.body ?? {}

    if (!name || !cnpj || !email || !planId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Campos obrigatórios: name, cnpj, email, planId' },
      })
    }

    const cnpjClean = String(cnpj).replace(/\D/g, '')
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const ownerName = (responsibleName && String(responsibleName).trim()) || name

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name,
          tradeName: tradeName ?? null,
          cnpj: cnpjClean,
          email,
          phone: phone ?? null,
          planId,
          planCycle: planCycle ?? 'MONTHLY',
          status: 'TRIAL',
          trialEndsAt,
          site: site ?? null,
          responsibleName: responsibleName ?? null,
          foundedAt: foundedAt ? new Date(foundedAt) : null,
          addressStreet: address?.street ?? null,
          addressNumber: address?.number ?? null,
          addressComplement: address?.complement ?? null,
          addressNeighborhood: address?.neighborhood ?? null,
          addressCity: address?.city ?? null,
          addressState: address?.state ?? null,
          addressZip: address?.cep ?? null,
        },
      })

      await tx.user.create({
        data: {
          tenantId: created.id,
          name: ownerName,
          email,
          passwordHash,
          role: 'OWNER',
        },
      })

      return created
    })

    return res.status(201).json({ success: true, data: { tenant, tempPassword } })
  } catch (error: any) {
    console.error('CREATE_TENANT_ERROR:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: error?.code ?? 'INTERNAL_ERROR',
        message: error?.message ?? 'Erro ao criar tenant',
        detail: error?.meta ?? null,
      },
    })
  }
})

// ── Create Charge for Tenant ──

router.post('/tenants/:id/charge', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id as string
    const { planId, planCycle, paymentMethod, discountValue, discountType } = req.body ?? {}

    if (!planId || !planCycle || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Campos obrigatórios: planId, planCycle, paymentMethod' },
      })
    }

    const [tenant, plan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ])

    if (!tenant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' } })
    if (!plan) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plano não encontrado' } })

    const baseValue = planCycle === 'YEARLY' ? Number(plan.priceYearly) : Number(plan.priceMonthly)
    let finalValue = baseValue
    let discountAbs = 0
    if (discountValue && Number(discountValue) > 0) {
      const dv = Number(discountValue)
      discountAbs = discountType === 'FIXED' ? dv : (baseValue * dv) / 100
      discountAbs = Math.min(baseValue, Math.round(discountAbs * 100) / 100)
      finalValue = Math.max(0, baseValue - discountAbs)
    }
    finalValue = Math.round(finalValue * 100) / 100

    const desc = `${plan.name} (${planCycle === 'YEARLY' ? 'Anual' : 'Mensal'}) — ${tenant.name}`
    const cnpjClean = tenant.document || tenant.cnpj.replace(/\D/g, '')

    if (paymentMethod === 'PIX') {
      const result = await createPixCharge(tenantId, {
        value: finalValue,
        description: desc,
        debtorName: tenant.name,
        debtorCpf: cnpjClean,
        discountValue: discountAbs > 0 ? discountAbs : undefined,
      })
      return res.json({ success: true, data: { ...result, amount: finalValue, discountValue: discountAbs, paymentMethod: 'PIX' } })
    } else if (paymentMethod === 'BOLETO') {
      const dueDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
      const result = await createBoletoCharge(tenantId, {
        value: finalValue,
        description: desc,
        dueDate,
        debtorName: tenant.name,
        debtorCpf: cnpjClean,
        debtorEmail: tenant.email,
        debtorStreet: tenant.addressStreet ?? undefined,
        debtorCity: tenant.addressCity ?? undefined,
        debtorState: tenant.addressState ?? undefined,
        debtorZipCode: tenant.addressZip ?? undefined,
        debtorNumber: tenant.addressNumber ?? undefined,
        debtorNeighborhood: tenant.addressNeighborhood ?? undefined,
        debtorComplement: tenant.addressComplement ?? undefined,
        discountValue: discountAbs > 0 ? discountAbs : undefined,
      })
      return res.json({ success: true, data: { ...result, amount: finalValue, discountValue: discountAbs, paymentMethod: 'BOLETO' } })
    } else {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'paymentMethod deve ser PIX ou BOLETO' } })
    }
  } catch (error: any) {
    console.error('CREATE_TENANT_CHARGE_ERROR:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: error?.code ?? 'INTERNAL_ERROR',
        message: error?.message ?? 'Erro ao criar cobrança',
        detail: error?.meta ?? null,
      },
    })
  }
})
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

// ── Tenant Notes ──

router.post('/tenants/:id/notes', async (req: Request, res: Response) => {
  try {
    const { content } = req.body
    if (!content?.trim()) { res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Conteúdo é obrigatório' } }); return }
    const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.userId } })
    const note = await prisma.tenantNote.create({
      data: { tenantId: req.params.id as string, content: content.trim(), author: admin?.name ?? 'Admin' },
    })
    res.json({ success: true, data: note })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.delete('/tenants/:id/notes/:noteId', async (req: Request, res: Response) => {
  try {
    await prisma.tenantNote.delete({ where: { id: req.params.noteId as string } })
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

// ── Update Charge (manual ops: discount, manual paid, cancel) ──

router.patch('/charges/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const charge = await prisma.charge.findUnique({ where: { id } })
    if (!charge) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cobrança não encontrada' } })
    }
    if (charge.status !== 'PENDING' && charge.status !== 'OVERDUE') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Apenas cobranças PENDING ou OVERDUE podem ser alteradas' },
      })
    }

    const { discountValue, amount, status, paidAt, paymentMethod, note } = req.body ?? {}

    if (status !== undefined && status !== 'PAID' && status !== 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status só pode ser PAID ou CANCELLED' },
      })
    }
    if (paymentMethod !== undefined && paymentMethod !== 'MANUAL') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'paymentMethod só pode ser MANUAL nesta rota' },
      })
    }

    const data: any = {}
    if (discountValue !== undefined) data.discountValue = discountValue === null ? null : Number(discountValue)
    if (amount !== undefined) data.amount = Number(amount)
    if (status !== undefined) {
      data.status = status
      if (status === 'PAID') data.paidAt = paidAt ? new Date(paidAt) : new Date()
    }
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod
    if (note !== undefined) data.note = note || null

    const updated = await prisma.charge.update({
      where: { id },
      data,
      include: { tenant: { select: { id: true, name: true, plan: { select: { id: true, name: true, slug: true } } } } },
    })

    return res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('UPDATE_CHARGE_ERROR:', error)
    return res.status(500).json({
      success: false,
      error: {
        code: error?.code ?? 'INTERNAL_ERROR',
        message: error?.message ?? 'Erro ao atualizar cobrança',
        detail: error?.meta ?? null,
      },
    })
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
      const result = await createPixCharge(charge.tenantId, { value, description: desc, debtorName: charge.tenant.name, debtorCpf: charge.tenant.document || charge.tenant.cnpj.replace(/\D/g, '') })
      res.json({ success: true, data: result })
    } else {
      const { createBoletoCharge } = await import('../services/efi.service')
      const dueDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
      const result = await createBoletoCharge(charge.tenantId, {
        value,
        description: desc,
        dueDate,
        debtorName: charge.tenant.name,
        debtorCpf: charge.tenant.document || charge.tenant.cnpj.replace(/\D/g, ''),
        debtorEmail: charge.tenant.email,
        debtorStreet: charge.tenant.addressStreet ?? undefined,
        debtorCity: charge.tenant.addressCity ?? undefined,
        debtorState: charge.tenant.addressState ?? undefined,
        debtorZipCode: charge.tenant.addressZip ?? undefined,
        debtorNumber: charge.tenant.addressNumber ?? undefined,
        debtorNeighborhood: charge.tenant.addressNeighborhood ?? undefined,
        debtorComplement: charge.tenant.addressComplement ?? undefined,
      })
      res.json({ success: true, data: result })
    }
  } catch (error: any) {
    console.error('[Admin] retry charge error:', error.message)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

// ── Popups ──

router.get('/popups', async (_req: Request, res: Response) => {
  try {
    const popups = await prisma.popup.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: popups })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.post('/popups', async (req: Request, res: Response) => {
  try {
    const { type, instances, plans, message, buttonLabel, buttonUrl, frequency, startDate, endDate, imageUrl, isActive } = req.body
    if (!type || !message || !frequency || !startDate) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Campos obrigatórios: type, message, frequency, startDate' } }); return
    }
    const popup = await prisma.popup.create({
      data: {
        type, instances: instances ?? [], plans: plans ?? [], message,
        buttonLabel: buttonLabel || null, buttonUrl: buttonUrl || null,
        frequency, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null,
        imageUrl: imageUrl || null, isActive: isActive ?? true, createdBy: req.user!.userId,
      },
    })
    res.json({ success: true, data: popup })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/popups/:id', async (req: Request, res: Response) => {
  try {
    const { type, instances, plans, message, buttonLabel, buttonUrl, frequency, startDate, endDate, imageUrl, isActive } = req.body
    const data: Record<string, unknown> = {}
    if (type !== undefined) data.type = type
    if (instances !== undefined) data.instances = instances
    if (plans !== undefined) data.plans = plans
    if (message !== undefined) data.message = message
    if (buttonLabel !== undefined) data.buttonLabel = buttonLabel || null
    if (buttonUrl !== undefined) data.buttonUrl = buttonUrl || null
    if (frequency !== undefined) data.frequency = frequency
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null
    if (isActive !== undefined) data.isActive = isActive
    const popup = await prisma.popup.update({ where: { id: req.params.id as string }, data })
    res.json({ success: true, data: popup })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.delete('/popups/:id', async (req: Request, res: Response) => {
  try {
    await prisma.popup.delete({ where: { id: req.params.id as string } })
    res.json({ success: true })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/popups/:id/toggle', async (req: Request, res: Response) => {
  try {
    const popup = await prisma.popup.findUnique({ where: { id: req.params.id as string } })
    if (!popup) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pop-up não encontrado' } }); return }
    const updated = await prisma.popup.update({ where: { id: req.params.id as string }, data: { isActive: !popup.isActive } })
    res.json({ success: true, data: updated })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

// ── Setup: PIX Webhook Registration ──

router.post('/setup/pix-webhook', async (_req: Request, res: Response) => {
  try {
    const result = await registerPixWebhook()
    res.json({ success: true, data: result })
  } catch (error: any) {
    const original = error?.original ?? error
    console.error('[Admin] setup/pix-webhook error:', {
      message: error?.message,
      origMessage: original?.message,
      response: original?.response?.data ?? original?.data ?? null,
      status: original?.response?.status ?? original?.status ?? null,
    })
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: error?.message ?? 'Erro ao registrar webhook PIX',
        detail: original?.response?.data ?? original?.data ?? original?.body ?? null,
        status: original?.response?.status ?? original?.status ?? null,
      },
    })
  }
})

// ── Internal Team ──

router.get('/team', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, isDualAccess: u.isDualAccess, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })) })
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
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, isDualAccess: user.isDualAccess, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } })
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
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, isDualAccess: user.isDualAccess, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } })
  } catch (error: any) { res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }) }
})

router.patch('/team/:id/status', async (req: Request, res: Response) => {
  try {
    const user = await prisma.adminUser.findUnique({ where: { id: req.params.id as string } })
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Membro não encontrado' } }); return }
    const updated = await prisma.adminUser.update({ where: { id: req.params.id as string }, data: { isActive: !user.isActive } })
    res.json({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive, isDualAccess: updated.isDualAccess, lastLoginAt: updated.lastLoginAt, createdAt: updated.createdAt } })
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

/**
 * PATCH /admin/users/:id/dual-access
 *
 * Grants or revokes the dual-access flag on a target admin user.
 * Locked down by two independent checks:
 *
 *  1. The caller (JWT userId) must themselves have isDualAccess=true.
 *     Only dual-access admins can hand out (or revoke) dual access.
 *  2. The caller must re-enter their own password in `ownerPassword`
 *     and have it verified against their bcrypt hash. This is a
 *     sensitive privilege — we don't want a hijacked session alone
 *     to be enough to grant platform-wide gestor access.
 *
 * Body: { isDualAccess: boolean, ownerPassword: string }
 */
router.patch('/users/:id/dual-access', async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId
    const targetId = req.params.id as string
    const { isDualAccess, ownerPassword } = req.body as { isDualAccess?: boolean; ownerPassword?: string }

    if (typeof isDualAccess !== 'boolean') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'isDualAccess é obrigatório e deve ser boolean' } })
      return
    }
    if (!ownerPassword || typeof ownerPassword !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'ownerPassword é obrigatório' } })
      return
    }

    const caller = await prisma.adminUser.findUnique({ where: { id: callerId } })
    if (!caller || !caller.isActive) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sessão inválida' } })
      return
    }
    if (!caller.isDualAccess) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas administradores com acesso duplo podem alterar este campo' } })
      return
    }

    const bcrypt = await import('bcryptjs')
    const passwordValid = await bcrypt.default.compare(ownerPassword, caller.passwordHash)
    if (!passwordValid) {
      res.status(403).json({ success: false, error: { code: 'INVALID_OWNER_PASSWORD', message: 'Senha incorreta' } })
      return
    }

    const target = await prisma.adminUser.findUnique({ where: { id: targetId } })
    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Membro não encontrado' } })
      return
    }

    const updated = await prisma.adminUser.update({
      where: { id: targetId },
      data: { isDualAccess },
    })

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        isDualAccess: updated.isDualAccess,
        lastLoginAt: updated.lastLoginAt,
        createdAt: updated.createdAt,
      },
    })
  } catch (error: any) {
    console.error('[Admin] dual-access update error:', error?.message ?? error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } })
  }
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

// ── Test SMTP Email ──

router.post('/test-email', async (req: Request, res: Response) => {
  try {
    const { to } = req.body ?? {}
    if (!to) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Campo obrigatório: to' } })
    }
    const result = await sendMail({
      to,
      subject: '✅ TriboCRM — Teste de e-mail',
      text: 'Se você recebeu este e-mail, o SMTP está configurado corretamente no TriboCRM!',
      tenantId: null,
    })
    if (result.sent) {
      return res.json({ success: true, sent: true })
    }
    return res.json({ success: false, error: result.error ?? result.reason ?? 'Falha ao enviar e-mail' })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message ?? 'Erro interno ao enviar e-mail de teste' })
  }
})

// ── Email Logs (sub-etapa 6L.1.b) ──
//
// Surface for the super-admin UI to inspect every transactional /
// system email persisted by mailer.service. Cursor-based pagination
// (id of the last item) avoids the offset-skip cost on large result
// sets. Defaults to 100 most recent rows; max 500.

const emailLogsQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  templateId: z.coerce.number().int().positive().optional(),
  tenantId: z.string().uuid().optional(),
  toEmail: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  cursor: z.string().uuid().optional(),
})

router.get('/email-logs', async (req: Request, res: Response) => {
  try {
    const parseResult = emailLogsQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Parâmetros inválidos',
          details: parseResult.error.flatten(),
        },
      })
      return
    }

    const q = parseResult.data
    const where: any = {}

    if (q.status) {
      const statuses = Array.isArray(q.status) ? q.status : [q.status]
      where.status = { in: statuses }
    }
    if (q.templateId !== undefined) where.templateId = q.templateId
    if (q.tenantId) where.tenantId = q.tenantId
    if (q.toEmail) where.toEmail = { contains: q.toEmail, mode: 'insensitive' }

    if (q.dateFrom || q.dateTo) {
      where.sentAt = {} as Record<string, Date>
      if (q.dateFrom) where.sentAt.gte = new Date(q.dateFrom)
      if (q.dateTo) where.sentAt.lte = new Date(q.dateTo)
    }

    // Fetch limit+1 to know whether a next page exists without a
    // separate count query.
    const fetchLimit = q.limit + 1

    const findArgs: any = {
      where,
      take: fetchLimit,
      orderBy: { sentAt: 'desc' },
    }
    if (q.cursor) {
      findArgs.cursor = { id: q.cursor }
      findArgs.skip = 1
    }

    const results = await prisma.emailLog.findMany(findArgs)

    const hasMore = results.length > q.limit
    const items = hasMore ? results.slice(0, q.limit) : results
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

    res.json({
      success: true,
      data: { items, hasMore, nextCursor },
    })
    return
  } catch (err: any) {
    console.error('[GET /admin/email-logs] erro:', err?.message)
    res.status(500).json({
      success: false,
      error: { code: 'EMAIL_LOGS_FAILED', message: 'Erro ao buscar logs' },
    })
    return
  }
})

// ── Email Campaigns (sub-etapa 6L.2.a) ──
//
// Broadcast de email transacional (template Brevo) pra grupos de
// usuários filtrados. MVP: dispara em loop sequencial com 100ms de
// delay entre envios. Logs caem em email_logs via sendTemplateMail
// (correlação com tenantId quando disponível). Listas grandes (>500)
// podem estourar o timeout HTTP — admin divide em lotes manualmente
// ou aguarda 6L.3 (background job).

const campaignFiltersSchema = z.object({
  planIds: z.array(z.string().uuid()).optional(),
  tenantStatuses: z.array(z.string()).optional(),
  roles: z.array(z.enum(['OWNER', 'MANAGER', 'TEAM_LEADER', 'SELLER'])).optional(),
})

const campaignPreviewBodySchema = z.object({
  filters: campaignFiltersSchema,
  audience: z.enum(['OWNERS', 'ALL_USERS']),
})

const campaignSendBodySchema = z.object({
  filters: campaignFiltersSchema,
  audience: z.enum(['OWNERS', 'ALL_USERS']),
  templateId: z.number().int().positive(),
  params: z.record(z.union([z.string(), z.number()])).default({}),
})

router.post('/campaign/preview', async (req: Request, res: Response) => {
  try {
    const parseResult = campaignPreviewBodySchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILTERS',
          message: 'Filtros inválidos',
          details: parseResult.error.flatten(),
        },
      })
      return
    }

    const { filters, audience } = parseResult.data
    const recipients = await resolveCampaignRecipients(
      filters as CampaignFilters,
      audience as CampaignAudience,
    )

    res.json({
      success: true,
      data: {
        count: recipients.length,
        sample: recipients.slice(0, 10),
      },
    })
    return
  } catch (err: any) {
    console.error('[POST /admin/campaign/preview] erro:', err?.message)
    res.status(500).json({
      success: false,
      error: { code: 'PREVIEW_FAILED', message: 'Erro ao calcular prévia' },
    })
    return
  }
})

router.post('/campaign/send', async (req: Request, res: Response) => {
  try {
    const parseResult = campaignSendBodySchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BODY',
          message: 'Dados inválidos',
          details: parseResult.error.flatten(),
        },
      })
      return
    }

    const { filters, audience, templateId, params } = parseResult.data

    // Pré-valida: tem destinatários? Evita criar campanha vazia que
    // só pra rodar e fechar como COMPLETED com 0 envios.
    const recipients = await resolveCampaignRecipients(
      filters as CampaignFilters,
      audience as CampaignAudience,
    )

    if (recipients.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_RECIPIENTS',
          message: 'Nenhum destinatário encontrado com esses filtros',
        },
      })
      return
    }

    // Sub-etapa 6L.3.a: cria EmailCampaign em PENDING. O campaign-runner
    // job (cron 1 min) faz pickup atômico e processa em background.
    // Resposta 202 retorna campaignId pra polling — frontend (6L.3.c)
    // vai consumir GET /admin/campaigns/:id pra acompanhar progresso.
    const campaign = await prisma.emailCampaign.create({
      data: {
        templateId,
        paramsJson: params,
        audience,
        filtersJson: filters,
        status: 'PENDING',
        totalRecipients: recipients.length,
        createdBy: (req as any).user?.userId ?? null,
      },
      select: {
        id: true,
        status: true,
        totalRecipients: true,
      },
    })

    console.log(`[Campaign] agendada ${campaign.id} pra ${campaign.totalRecipients} destinatários`)

    res.status(202).json({
      success: true,
      data: {
        campaignId: campaign.id,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
      },
    })
    return
  } catch (err: any) {
    console.error('[POST /admin/campaign/send] erro:', err?.message)
    res.status(500).json({
      success: false,
      error: { code: 'CAMPAIGN_FAILED', message: 'Erro ao agendar campanha' },
    })
    return
  }
})

// ── Email Campaigns — listagem + detalhe + cancel (sub-etapa 6L.3.b) ──
//
// GET    /admin/campaigns           — lista paginada (cursor)
// GET    /admin/campaigns/:id       — detalhe com progresso (frontend faz polling)
// POST   /admin/campaigns/:id/cancel — marca CANCELLED; runner pega na próxima iter

const campaignsListQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().uuid().optional(),
})

router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const parseResult = campaignsListQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Parâmetros inválidos',
          details: parseResult.error.flatten(),
        },
      })
      return
    }

    const q = parseResult.data
    const where: any = {}

    if (q.status) {
      const statuses = Array.isArray(q.status) ? q.status : [q.status]
      where.status = { in: statuses }
    }

    const fetchLimit = q.limit + 1
    const findArgs: any = {
      where,
      take: fetchLimit,
      orderBy: { createdAt: 'desc' },
    }
    if (q.cursor) {
      findArgs.cursor = { id: q.cursor }
      findArgs.skip = 1
    }

    const results = await prisma.emailCampaign.findMany(findArgs)

    const hasMore = results.length > q.limit
    const items = hasMore ? results.slice(0, q.limit) : results
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

    res.json({
      success: true,
      data: { items, hasMore, nextCursor },
    })
    return
  } catch (err: any) {
    console.error('[GET /admin/campaigns] erro:', err?.message)
    res.status(500).json({
      success: false,
      error: { code: 'CAMPAIGNS_LIST_FAILED', message: 'Erro ao listar campanhas' },
    })
    return
  }
})

router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const uuidCheck = z.string().uuid().safeParse(id)
    if (!uuidCheck.success) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'ID inválido' },
      })
      return
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    })

    if (!campaign) {
      res.status(404).json({
        success: false,
        error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campanha não encontrada' },
      })
      return
    }

    res.json({ success: true, data: campaign })
    return
  } catch (err: any) {
    console.error('[GET /admin/campaigns/:id] erro:', err?.message)
    res.status(500).json({
      success: false,
      error: { code: 'CAMPAIGN_DETAIL_FAILED', message: 'Erro ao buscar campanha' },
    })
    return
  }
})

router.post('/campaigns/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const uuidCheck = z.string().uuid().safeParse(id)
    if (!uuidCheck.success) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'ID inválido' },
      })
      return
    }

    const existing = await prisma.emailCampaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campanha não encontrada' },
      })
      return
    }

    if (!['PENDING', 'RUNNING'].includes(existing.status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_CANCEL',
          message: `Campanha não pode ser cancelada (status atual: ${existing.status})`,
        },
      })
      return
    }

    // Atomic guard contra race com o runner (que pode estar mudando
    // status na mesma janela). updateMany.count===0 indica que outro
    // ator já moveu o status entre nosso findUnique e a tentativa
    // de update — devolvemos 409 pra UI tentar reler o estado.
    const updateResult = await prisma.emailCampaign.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'CANCELLED' },
    })

    if (updateResult.count === 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATUS_CHANGED',
          message: 'Status da campanha mudou; tente novamente',
        },
      })
      return
    }

    console.log(`[Campaign] ${id} cancelada pelo admin`)

    res.json({
      success: true,
      data: { id, status: 'CANCELLED' },
    })
    return
  } catch (err: any) {
    console.error('[POST /admin/campaigns/:id/cancel] erro:', err?.message)
    res.status(500).json({
      success: false,
      error: { code: 'CANCEL_FAILED', message: 'Erro ao cancelar campanha' },
    })
    return
  }
})

// ── Billing Jobs ──

// Manual trigger for the billing state machine job (sub-etapa 6C).
// Fires the run asynchronously — the handler returns 200 immediately
// and the job runs in background. Useful to validate a deploy without
// waiting for the 09:30 BRT cron window. Audit line is new on purpose:
// mass-action triggers deserve a "who pulled the lever" trail.
router.post('/jobs/billing-state-machine/run', async (req: Request, res: Response) => {
  try {
    console.log(`[Admin] billing-state-machine manual trigger by userId=${req.user?.userId ?? 'unknown'}`)

    runBillingStateMachineJob().catch((err) => {
      console.error('[BillingStateMachine] uncaught error from manual trigger:', err)
    })

    return res.json({
      success: true,
      data: { message: 'Job started. Check logs for results.' },
    })
  } catch (error: any) {
    console.error('[Admin] billing-state-machine trigger failed:', error)
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message ?? 'Erro ao disparar job' },
    })
  }
})

export default router
