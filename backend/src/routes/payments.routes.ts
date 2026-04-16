import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import {
  createPixCharge,
  createBoletoCharge,
  createCardSubscription,
  getChargeStatus,
  getPaymentHistory,
  processWebhookPayment,
  registerPixWebhook,
} from '../services/efi.service'

const router = Router()

// ── Public: list plans ──

router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })
    res.json({ success: true, data: plans.map(p => ({ id: p.id, name: p.name, slug: p.slug, priceMonthly: Number(p.priceMonthly), priceYearly: Number(p.priceYearly), maxUsers: p.maxUsers, maxLeads: p.maxLeads, maxPipelines: p.maxPipelines, maxAutomations: p.maxAutomations, maxForms: p.maxForms, features: p.features })) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

const SANDBOX_CPF = '11144477735'

async function getPixDebtorData(tenantId: string, userId: string) {
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, cnpj: true, email: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, cpf: true } }),
  ])

  const isSandbox = process.env.EFI_SANDBOX === 'true'
  const cnpjClean = tenant?.cnpj?.replace(/\D/g, '') ?? ''
  const cpfClean = user?.cpf?.replace(/\D/g, '') ?? ''

  return {
    debtorName: tenant?.name ?? user?.name ?? 'Cliente TriboCRM',
    debtorCpf: cnpjClean || cpfClean || (isSandbox ? SANDBOX_CPF : ''),
    debtorEmail: tenant?.email ?? user?.email ?? '',
  }
}

async function getBoletoDebtorData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, cpf: true },
  })

  const isSandbox = process.env.EFI_SANDBOX === 'true'
  const cpfClean = user?.cpf?.replace(/\D/g, '') ?? ''

  return {
    debtorName: user?.name ?? 'Cliente TriboCRM',
    debtorCpf: cpfClean || (isSandbox ? SANDBOX_CPF : ''),
    debtorEmail: user?.email ?? '',
  }
}

// ── PIX ──

router.post('/pix', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId, userId } = req.user!
    if (role !== 'OWNER' && role !== 'MANAGER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas donos e gestores podem gerar cobranças' } })
      return
    }

    const { value, description, expiresIn } = req.body
    const debtor = await getPixDebtorData(tenantId, userId)

    const result = await createPixCharge(tenantId, {
      value, description, expiresIn,
      debtorName: debtor.debtorName,
      debtorCpf: debtor.debtorCpf,
    })
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Payments] PIX error:', error)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

// ── Boleto ──

router.post('/boleto', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId, userId } = req.user!
    if (role !== 'OWNER' && role !== 'MANAGER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas donos e gestores podem gerar cobranças' } })
      return
    }

    const { value, description, dueDate, debtorStreet, debtorCity, debtorState, debtorZipCode, document } = req.body

    // Persist the CPF/CNPJ on the tenant row so subsequent boletos
    // don't require the gestor to retype it. Only writes when the
    // caller actually provided a value — empty bodies leave the
    // existing tenant.document untouched.
    if (typeof document === 'string' && document.trim()) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { document: document.trim().slice(0, 18) },
      })
    }

    const [tenant, user] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, document: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ])

    const debtor = await getBoletoDebtorData(userId)
    // customer* takes precedence inside efi.service when document is
    // present — send the real tenant name + the gestor's email so the
    // charge is properly attributed on Efi dashboards.
    const effectiveDocument = (typeof document === 'string' && document.trim()) ? document.trim() : (tenant?.document ?? '')

    const result = await createBoletoCharge(tenantId, {
      value, description, dueDate,
      debtorName: debtor.debtorName,
      debtorCpf: debtor.debtorCpf,
      debtorEmail: debtor.debtorEmail,
      debtorStreet: debtorStreet ?? 'Rua não informada',
      debtorCity: debtorCity ?? 'São Paulo',
      debtorState: debtorState ?? 'SP',
      debtorZipCode: debtorZipCode ?? '01000000',
      customerName: tenant?.name ?? debtor.debtorName,
      customerEmail: user?.email ?? debtor.debtorEmail,
      document: effectiveDocument || undefined,
    })
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Payments] Boleto error:', error)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

// GET /payments/document
//
// Returns the currently-saved tenant.document so the checkout screen
// can pre-fill the CPF/CNPJ field when the gestor comes back to
// generate another boleto.
router.get('/document', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { document: true },
    })
    res.json({ success: true, data: { document: tenant?.document ?? null } })
  } catch (error: any) {
    console.error('[Payments] get document error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// ── Status ──

router.get('/:txid/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getChargeStatus(req.params.txid as string)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } })
  }
})

// ── Upgrade ──

router.post('/upgrade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId, userId } = req.user!
    if (role !== 'OWNER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas o dono pode fazer upgrade' } })
      return
    }

    const { newPlanId, paymentMethod } = req.body
    const [tenant, newPlan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } }),
      prisma.plan.findUnique({ where: { id: newPlanId } }),
    ])

    if (!tenant || !newPlan) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant ou plano não encontrado' } }); return }

    const currentPrice = tenant.planCycle === 'YEARLY' ? Number(tenant.plan.priceYearly) / 12 : Number(tenant.plan.priceMonthly)
    const newPrice = tenant.planCycle === 'YEARLY' ? Number(newPlan.priceYearly) / 12 : Number(newPlan.priceMonthly)
    const diff = newPrice - currentPrice
    if (diff <= 0) { res.status(400).json({ success: false, error: { code: 'INVALID', message: 'Novo plano deve ser superior ao atual' } }); return }

    const now = new Date()
    const expiresAt = tenant.planExpiresAt ?? new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysLeft = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const proratedValue = Math.round((daysLeft / 30) * diff * 100) / 100

    const debtor = await getPixDebtorData(tenantId, userId)

    if (paymentMethod === 'BOLETO') {
      const dueDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const boletoDebtor = await getBoletoDebtorData(userId)
      const result = await createBoletoCharge(tenantId, { value: proratedValue, description: `Upgrade para ${newPlan.name}`, dueDate, debtorName: boletoDebtor.debtorName, debtorCpf: boletoDebtor.debtorCpf, debtorEmail: boletoDebtor.debtorEmail, debtorStreet: 'Não informado', debtorCity: 'São Paulo', debtorState: 'SP', debtorZipCode: '01000000' })
      res.json({ success: true, data: { ...result, proratedValue, newPlanName: newPlan.name } })
    } else {
      const result = await createPixCharge(tenantId, { value: proratedValue, description: `Upgrade para ${newPlan.name}`, debtorName: debtor.debtorName, debtorCpf: debtor.debtorCpf })
      res.json({ success: true, data: { ...result, proratedValue, newPlanName: newPlan.name } })
    }
  } catch (error: any) {
    console.error('[Payments] upgrade error:', error)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

// ── Card Subscription ──

router.post('/card-subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId, userId } = req.user!
    if (role !== 'OWNER') { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas o dono' } }); return }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, cpf: true } })
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } })
    if (!tenant) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' } }); return }

    const value = tenant.planCycle === 'YEARLY' ? Number(tenant.plan.priceYearly) : Number(tenant.plan.priceMonthly)

    const result = await createCardSubscription(tenantId, {
      ...req.body,
      value,
      description: `TriboCRM ${tenant.plan.name} — ${tenant.planCycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
      customerName: user?.name ?? 'Cliente',
      customerCpf: user?.cpf ?? '',
      customerEmail: user?.email ?? '',
    })
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Payments] card error:', error)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

// ── Cancel ──

router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId } = req.user!
    if (role !== 'OWNER') { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas o dono pode cancelar' } }); return }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' } }); return }

    const expiresAt = tenant.planExpiresAt ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'CANCELLED', planExpiresAt: expiresAt },
    })

    res.json({ success: true, data: { expiresAt: expiresAt.toISOString() } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// ── History ──

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await getPaymentHistory(req.user!.tenantId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// ── Setup Webhook ──

router.post('/setup-webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role } = req.user!
    if (role !== 'OWNER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas o dono pode configurar webhooks' } })
      return
    }

    const result = await registerPixWebhook()
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Payments] setup-webhook error:', error)
    res.status(500).json({ success: false, error: { code: 'WEBHOOK_ERROR', message: error.message } })
  }
})

// ── Efi Webhook (public — no auth) ──

router.post('/webhook/efi', async (req: Request, res: Response) => {
  try {
    const { pix } = req.body

    if (pix && Array.isArray(pix)) {
      for (const payment of pix) {
        if (payment.txid) {
          await processWebhookPayment(payment.txid)
        }
      }
    }

    res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('[Webhook] Efi error:', error)
    res.status(500).json({ success: false })
  }
})

export default router
