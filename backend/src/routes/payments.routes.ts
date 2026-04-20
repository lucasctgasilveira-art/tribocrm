import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import {
  createPixCharge,
  createBoletoCharge,
  createCardSubscription,
  cancelCardSubscription,
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

// ── Subscription Form Data (sub-etapa 6J.5.1) ──
//
// Pré-carrega os campos que o formulário de cartão (frontend) precisa:
// dados do customer (do user owner) + endereço de cobrança (do tenant)
// + resumo do plano atual. Reporta missing[] quando algum campo
// obrigatório está vazio — UI mostra "Complete seu perfil antes de
// cadastrar cartão" em vez de mandar um submit que o Efi rejeitaria.

router.get(
  '/subscription-form-data',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { role, tenantId, userId } = req.user!

      if (role !== 'OWNER') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Apenas o OWNER pode gerenciar cartão' },
        })
        return
      }

      if (!tenantId || !userId) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_CONTEXT', message: 'Usuário sem tenant vinculado' },
        })
        return
      }

      const [user, tenant] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, cpf: true },
        }),
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            planCycle: true,
            addressStreet: true,
            addressNumber: true,
            addressComplement: true,
            addressNeighborhood: true,
            addressCity: true,
            addressState: true,
            addressZip: true,
            plan: {
              select: { name: true, priceMonthly: true, priceYearly: true },
            },
          },
        }),
      ])

      if (!user || !tenant || !tenant.plan) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Usuário, tenant ou plano não encontrado' },
        })
        return
      }

      const missing: string[] = []
      if (!user.cpf?.trim()) missing.push('cpf')
      if (!tenant.addressStreet?.trim()) missing.push('rua')
      if (!tenant.addressNumber?.trim()) missing.push('numero')
      if (!tenant.addressZip?.trim()) missing.push('cep')
      if (!tenant.addressCity?.trim()) missing.push('cidade')
      if (!tenant.addressState?.trim()) missing.push('estado')

      if (missing.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INCOMPLETE_PROFILE',
            message: 'Complete seu perfil antes de cadastrar o cartão',
            details: { missing },
          },
        })
        return
      }

      const priceValue =
        tenant.planCycle === 'YEARLY'
          ? Number(tenant.plan.priceYearly)
          : Number(tenant.plan.priceMonthly)

      const priceFormatted = priceValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      res.json({
        success: true,
        data: {
          customer: {
            name: user.name,
            email: user.email,
            cpf: user.cpf ?? '',
          },
          billingAddress: {
            street: tenant.addressStreet ?? '',
            number: tenant.addressNumber ?? '',
            neighborhood: tenant.addressNeighborhood ?? '',
            zipcode: tenant.addressZip ?? '',
            city: tenant.addressCity ?? '',
            state: tenant.addressState ?? '',
            ...(tenant.addressComplement
              ? { complement: tenant.addressComplement }
              : {}),
          },
          plan: {
            name: tenant.plan.name,
            cycle: tenant.planCycle,
            priceFormatted,
            priceValue,
          },
        },
      })
      return
    } catch (err: any) {
      console.error('[GET /subscription-form-data] erro:', err?.message)
      res.status(500).json({
        success: false,
        error: {
          code: 'FORM_DATA_FAILED',
          message: 'Falha ao carregar dados do formulário',
        },
      })
      return
    }
  },
)

// ── Card Subscription ──

const cardSubscriptionBodySchema = z.object({
  paymentToken: z.string().min(10, 'paymentToken inválido'),
  billingAddress: z.object({
    street: z.string().min(1),
    number: z.string().min(1),
    neighborhood: z.string().min(1),
    zipcode: z.string().min(8),
    city: z.string().min(1),
    state: z.string().length(2),
    complement: z.string().optional(),
  }),
  customer: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    cpf: z.string().min(11),
    birth: z.string().optional(),
    phone_number: z.string().optional(),
  }),
})

router.post(
  '/card-subscription',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { role, tenantId } = req.user!

      if (role !== 'OWNER') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Apenas o OWNER pode gerenciar cartão' },
        })
        return
      }

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_TENANT', message: 'Usuário sem tenant vinculado' },
        })
        return
      }

      const parseResult = cardSubscriptionBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BODY',
            message: 'Dados do cartão inválidos',
            details: parseResult.error.flatten(),
          },
        })
        return
      }

      const body = parseResult.data

      const result = await createCardSubscription({
        tenantId,
        paymentToken: body.paymentToken,
        billingAddress: body.billingAddress,
        customer: body.customer,
      })

      res.json({
        success: true,
        data: {
          subscriptionId: result.subscriptionId,
          chargeId: result.chargeId,
          status: result.status,
          nextBillingAt: result.nextBillingAt,
        },
      })
      return
    } catch (err: any) {
      console.error('[POST /card-subscription] erro:', err?.message)
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_FAILED',
          message: err?.message ?? 'Falha ao processar assinatura',
        },
      })
      return
    }
  },
)

// ── Cancel ──

router.post(
  '/cancel',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { role, tenantId } = req.user!

      if (role !== 'OWNER') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Apenas o OWNER pode cancelar a assinatura' },
        })
        return
      }

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_TENANT', message: 'Usuário sem tenant vinculado' },
        })
        return
      }

      // Best-effort cancel on Efi's side. Never blocks the local
      // state flip — if the remote call fails, operator sees the log
      // and reconciles manually rather than leaving the customer
      // stuck with an uncancellable subscription.
      try {
        await cancelCardSubscription(tenantId)
      } catch (err: any) {
        console.error(`[POST /cancel] falha ao cancelar Efi:`, err?.message)
      }

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'CANCELLED',
        },
      })

      res.json({ success: true })
      return
    } catch (err: any) {
      console.error('[POST /cancel] erro:', err?.message)
      res.status(500).json({
        success: false,
        error: { code: 'CANCEL_FAILED', message: 'Falha ao cancelar assinatura' },
      })
      return
    }
  },
)

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
