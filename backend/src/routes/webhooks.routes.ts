import { Router, Request, Response } from 'express'
import { timingSafeEqual } from 'crypto'
import { processWebhookPayment, processSubscriptionNotification } from '../services/efi.service'

const router = Router()

// Official Efi egress IPs. Array (not a single string) so contingency /
// staging IPs can be added without changing the comparison logic.
const EFI_PROD_IPS = ['34.193.116.226']

// ────────────────────────────────────────────────────────────────────
// POST /webhooks/efi        — legacy path
// POST /webhooks/efi/pix    — path Efi hits after registering the URL
//                             (the platform appends /pix before the query
//                             string of the URL we registered)
//
// Security model:
//   1. HMAC via query param ?hmac=<EFI_WEBHOOK_HMAC>. Constant-time
//      compare. Fail-fast if env is missing in production.
//   2. IP allowlist (only in production) against the published Efi
//      egress IPs. Read from x-forwarded-for because Railway's reverse
//      proxy makes req.ip and req.socket.remoteAddress unreliable.
//   3. GET/HEAD on the same paths stay free of auth — Efi probes
//      reachability before accepting the webhook registration.
//
// Efi sends 2 payload shapes:
//   PIX:    { "pix": [ { "txid": "...", ... }, ... ] }
//   Boleto: { "notification": "...", "charge": { "id": ..., "status": "paid" } }
// ────────────────────────────────────────────────────────────────────

// Extract client IP via the x-forwarded-for chain. Railway puts the real
// caller first in that list. We intentionally don't rely on req.ip
// because app.ts doesn't set 'trust proxy' in this phase.
function extractClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim()
  return first || req.socket.remoteAddress || ''
}

function validHmac(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

async function handleEfiWebhook(req: Request, res: Response): Promise<void> {
  const expected = process.env.EFI_WEBHOOK_HMAC ?? ''
  const isProd = process.env.NODE_ENV === 'production'

  // ── 1. Fail-fast on misconfig ──
  if (isProd && !expected) {
    console.error('[Webhook:efi] BLOCKED — EFI_WEBHOOK_HMAC not set in production')
    res.status(500).json({ success: false, error: 'webhook misconfigured' })
    return
  }

  // ── 2. HMAC validation ──
  const provided = String(req.query.hmac ?? '')
  if (!validHmac(provided, expected)) {
    console.warn('[Webhook:efi] REJECTED invalid hmac', {
      ip: extractClientIp(req),
      hasHmac: provided.length > 0,
    })
    res.status(401).json({ success: false, error: 'invalid hmac' })
    return
  }

  // ── 3. IP allowlist (prod only) ──
  const clientIp = extractClientIp(req)
  if (isProd && !EFI_PROD_IPS.includes(clientIp)) {
    console.warn('[Webhook:efi] REJECTED invalid IP', {
      ip: clientIp,
      expected: EFI_PROD_IPS,
    })
    res.status(401).json({ success: false, error: 'invalid origin' })
    return
  }

  console.log('[Webhook:efi] accepted hmac+ip valid', { ip: clientIp })

  // Always respond 200 immediately so Efi doesn't retry
  // Process asynchronously after responding
  res.status(200).json({ success: true })

  try {
    const body = req.body
    console.log('[Webhook:efi] received:', JSON.stringify(body).slice(0, 500))

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

    // ── Subscription notification payload (sub-etapa 6J.4) ──
    // Efi envia { notification: "<token_opaco>" } pra eventos de
    // assinatura (ativação, renovação mensal, mudança de status).
    // O guard !body.charge protege o branch Boleto acima, que manda
    // notification junto com charge.
    if (typeof body?.notification === 'string' && !body.charge) {
      const token = body.notification
      const result = await processSubscriptionNotification(token)
      if (result.ok) {
        console.log(
          `[Webhook:efi:subscription] ${result.reason ?? 'processed'} ` +
          `sub=${result.subscriptionId} charge=${result.chargeId ?? '-'} ` +
          `tenant=${result.tenantId ?? '-'}`,
        )
      } else {
        console.warn(
          `[Webhook:efi:subscription] token=${token.slice(0, 10)}... ` +
          `failed: ${result.reason}`,
        )
      }
      return
    }

    console.warn('[Webhook:efi] unrecognized payload shape')
  } catch (error) {
    // Never throw — Efi already received its 200 OK
    console.error('[Webhook:efi] processing error:', error)
  }
}

// Efi calls GET/HEAD on the webhook URL to verify it is reachable before
// accepting pixConfigWebhook registration. Both must return 200 without
// any auth, on both /efi and /efi/pix since the platform may probe either.
router.get('/efi', (_req: Request, res: Response) => {
  res.status(200).send('ok')
})
router.head('/efi', (_req: Request, res: Response) => {
  res.status(200).end()
})
router.get('/efi/pix', (_req: Request, res: Response) => {
  res.status(200).send('ok')
})
router.head('/efi/pix', (_req: Request, res: Response) => {
  res.status(200).end()
})

router.post('/efi', handleEfiWebhook)
router.post('/efi/pix', handleEfiWebhook)

export default router
