import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  createPixCharge,
  createBoletoCharge,
  getChargeStatus,
  processWebhookPayment,
  registerPixWebhook,
} from '../services/efi.service'

const router = Router()

// ── PIX ──

router.post('/pix', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId } = req.user!
    if (role !== 'OWNER' && role !== 'MANAGER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas donos e gestores podem gerar cobranças' } })
      return
    }

    const { value, description, expiresIn, debtorName, debtorCpf } = req.body
    const result = await createPixCharge(tenantId, { value, description, expiresIn, debtorName, debtorCpf })
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Payments] PIX error:', error)
    res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: error.message } })
  }
})

// ── Boleto ──

router.post('/boleto', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, tenantId } = req.user!
    if (role !== 'OWNER' && role !== 'MANAGER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas donos e gestores podem gerar cobranças' } })
      return
    }

    const { value, description, dueDate, debtorName, debtorCpf, debtorEmail, debtorStreet, debtorCity, debtorState, debtorZipCode } = req.body
    const result = await createBoletoCharge(tenantId, { value, description, dueDate, debtorName, debtorCpf, debtorEmail, debtorStreet, debtorCity, debtorState, debtorZipCode })
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
