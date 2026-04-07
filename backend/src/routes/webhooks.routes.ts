import { Router, Request, Response } from 'express'
import { processWebhookPayment } from '../services/efi.service'

const router = Router()

/**
 * POST /webhooks/efi
 *
 * Receives payment confirmations from Banco Efi for both PIX and Boleto.
 * Always returns 200 OK so Efi does not retry on internal errors.
 *
 * PIX payload (Efi sends an array of paid PIX events):
 * {
 *   "pix": [
 *     { "endToEndId": "E...", "txid": "...", "valor": "97.00",
 *       "horario": "2026-04-07T10:00:00Z", "pagador": {...} }
 *   ]
 * }
 *
 * Boleto/Carnê payload:
 * {
 *   "notification": "<token>",
 *   "charge": { "id": 12345, "status": "paid" }
 * }
 *
 * Security: Efi normally uses mTLS for the webhook endpoint. For now we
 * accept any POST and validate the payload shape. EFI_WEBHOOK_SECRET env
 * var is reserved for a future header-based check.
 */
router.post('/efi', async (req: Request, res: Response) => {
  // Always respond 200 immediately so Efi doesn't retry
  // Process asynchronously after responding
  res.status(200).json({ success: true })

  try {
    const body = req.body
    console.log('[Webhook:efi] received:', JSON.stringify(body).slice(0, 500))

    // Optional secret validation (reserved for future header check)
    const expectedSecret = process.env.EFI_WEBHOOK_SECRET
    const providedSecret = req.headers['x-efi-secret'] as string | undefined
    if (expectedSecret && providedSecret !== expectedSecret) {
      console.warn('[Webhook:efi] invalid secret header — ignoring payload')
      return
    }

    // ── PIX payload ──
    if (Array.isArray(body?.pix)) {
      for (const pix of body.pix) {
        const txid = pix?.txid
        if (!txid || typeof txid !== 'string') {
          console.warn('[Webhook:efi:pix] missing txid in entry, skipping')
          continue
        }
        const result = await processWebhookPayment(txid)
        if (result.ok) {
          console.log(`[Webhook:efi:pix] charge ${result.chargeId} paid for tenant ${result.tenantId} (${result.reason ?? 'newly_paid'})`)
        } else {
          console.warn(`[Webhook:efi:pix] txid=${txid} failed: ${result.reason}`)
        }
      }
      return
    }

    // ── Boleto / Carnê payload ──
    if (body?.charge && body.charge.id !== undefined) {
      const status = String(body.charge.status ?? '').toLowerCase()
      if (status !== 'paid') {
        console.log(`[Webhook:efi:boleto] charge ${body.charge.id} status=${status}, ignoring`)
        return
      }
      const efiId = String(body.charge.id)
      const result = await processWebhookPayment(efiId)
      if (result.ok) {
        console.log(`[Webhook:efi:boleto] charge ${result.chargeId} paid for tenant ${result.tenantId} (${result.reason ?? 'newly_paid'})`)
      } else {
        console.warn(`[Webhook:efi:boleto] efiId=${efiId} failed: ${result.reason}`)
      }
      return
    }

    console.warn('[Webhook:efi] unrecognized payload shape')
  } catch (error) {
    // Never throw — Efi already received its 200 OK
    console.error('[Webhook:efi] processing error:', error)
  }
})

export default router
