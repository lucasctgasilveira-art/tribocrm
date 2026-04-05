import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import {
  createPixCharge,
  createBoletoCharge,
  getChargeStatus,
  processWebhookPayment,
  registerPixWebhook,
} from '../services/efi.service'

const router = Router()

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

    const { value, description, dueDate, debtorStreet, debtorCity, debtorState, debtorZipCode } = req.body
    const debtor = await getBoletoDebtorData(userId)

    const result = await createBoletoCharge(tenantId, {
      value, description, dueDate,
      debtorName: debtor.debtorName,
      debtorCpf: debtor.debtorCpf,
      debtorEmail: debtor.debtorEmail,
      debtorStreet: debtorStreet ?? 'Rua não informada',
      debtorCity: debtorCity ?? 'São Paulo',
      debtorState: debtorState ?? 'SP',
      debtorZipCode: debtorZipCode ?? '01000000',
    })
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Payments] Boleto error:', error)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
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
