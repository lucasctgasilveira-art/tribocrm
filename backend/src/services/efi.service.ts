import path from 'path'
import fs from 'fs'
import os from 'os'
import EfiPay from 'sdk-typescript-apis-efi'
import { prisma } from '../lib/prisma'

const isSandbox = process.env.EFI_SANDBOX === 'true'

function loadCertificate(): string {
  const certPath = isSandbox
    ? path.resolve(__dirname, '../../certs/efi-sandbox-cert.p12')
    : path.resolve(__dirname, '../../certs/efi-cert.p12')

  // 1. Try physical file (local development)
  if (fs.existsSync(certPath)) {
    return certPath
  }

  // 2. Try environment variable base64 (Railway production)
  const certEnvVar = isSandbox ? process.env.EFI_SANDBOX_CERT_BASE64 : process.env.EFI_PROD_CERT_BASE64

  if (certEnvVar) {
    const tmpPath = path.join(os.tmpdir(), isSandbox ? 'efi-sandbox-cert.p12' : 'efi-cert.p12')
    fs.writeFileSync(tmpPath, Buffer.from(certEnvVar, 'base64'))
    return tmpPath
  }

  throw new Error('Certificado Efi não encontrado — configure o arquivo .p12 ou a variável EFI_SANDBOX_CERT_BASE64 / EFI_PROD_CERT_BASE64')
}

function getClient(): EfiPay {
  const certificate = loadCertificate()

  return new EfiPay({
    client_id: process.env.EFI_CLIENT_ID,
    client_secret: process.env.EFI_CLIENT_SECRET,
    sandbox: isSandbox,
    certificate,
  } as any)
}

// ── PIX ──

interface PixChargeData {
  value: number // em reais (ex: 349.00) — valor final cobrado, já com desconto aplicado
  description: string
  expiresIn?: number // segundos, padrão 1800 (30min)
  debtorName: string
  debtorCpf: string
  discountValue?: number // valor absoluto do desconto em R$, para registro
}

interface PixChargeResult {
  txid: string
  pixCopiaECola: string
  qrCode: string // base64
  expiresAt: string
}

export async function createPixCharge(tenantId: string, chargeData: PixChargeData): Promise<PixChargeResult> {
  const efi = getClient()
  const txid = `tribo${Date.now()}${Math.random().toString(36).slice(2, 8)}`

  const expiresIn = chargeData.expiresIn ?? 1800
  const valueStr = chargeData.value.toFixed(2)
  const cpfClean = chargeData.debtorCpf.replace(/\D/g, '')

  // Create immediate charge (cob)
  const cobBody: any = {
    calendario: { expiracao: expiresIn },
    valor: { original: valueStr },
    chave: process.env.EFI_PIX_KEY ?? '',
    solicitacaoPagador: chargeData.description,
  }

  // Add debtor — use cpf (11 digits) or cnpj (14 digits)
  if (cpfClean.length === 14) {
    cobBody.devedor = { cnpj: cpfClean, nome: chargeData.debtorName }
  } else if (cpfClean.length === 11) {
    cobBody.devedor = { cpf: cpfClean, nome: chargeData.debtorName }
  }

  console.log('[Efi PIX] Creating charge:', JSON.stringify({ txid, value: valueStr, debtor: cobBody.devedor, chave: cobBody.chave }))

  // Create immediate charge — pixCopiaECola comes directly in the response
  const cob = await efi.pixCreateImmediateCharge([] as any, cobBody) as any
  console.log('[Efi PIX] cob keys:', Object.keys(cob || {}))
  console.log('[Efi PIX] Full response:', JSON.stringify(cob, null, 2))

  const pixCopiaECola = cob?.pixCopiaECola ?? cob?.location ?? ''

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Save to database
  await prisma.charge.create({
    data: {
      tenantId,
      efiChargeId: txid,
      amount: chargeData.value,
      discountValue: chargeData.discountValue ?? null,
      dueDate: new Date(expiresAt),
      paymentMethod: 'PIX',
      status: 'PENDING',
      referenceMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    },
  })

  return {
    txid,
    pixCopiaECola,
    qrCode: '',
    expiresAt,
  }
}

// ── Boleto ──

interface BoletoChargeData {
  value: number
  description: string
  dueDate: string // YYYY-MM-DD
  debtorName: string
  debtorCpf: string
  debtorEmail: string
  debtorStreet: string
  debtorCity: string
  debtorState: string
  debtorZipCode: string
  discountValue?: number // valor absoluto do desconto em R$, para registro
  // Newer checkout flow prefers these three — when a `document` is
  // passed, it's split into cpf (11 digits) or cnpj (14 digits) so a
  // pessoa jurídica can be billed as well. Legacy callers using only
  // debtorCpf keep working because the fallback below.
  customerName?: string
  customerEmail?: string
  document?: string
}

interface BoletoChargeResult {
  chargeId: string
  boletoUrl: string
  barCode: string
  dueDate: string
}

export async function createBoletoCharge(tenantId: string, chargeData: BoletoChargeData): Promise<BoletoChargeResult> {
  const efi = getClient()

  // Prefer the explicit `document` when provided by the new checkout
  // flow (can be CPF or CNPJ). Fall back to legacy `debtorCpf` so
  // existing upgrade/card flows keep working unchanged.
  const docClean = (chargeData.document ?? chargeData.debtorCpf ?? '').replace(/\D/g, '')
  const customer: any = {
    name: chargeData.customerName ?? chargeData.debtorName,
    email: chargeData.customerEmail ?? chargeData.debtorEmail,
  }
  if (docClean.length === 14) {
    customer.cnpj = docClean
  } else if (docClean.length === 11) {
    customer.cpf = docClean
  } else {
    // Keep Efi happy in dev/sandbox when no document was provided; the
    // real gestor-entered value only arrives via the checkout field.
    customer.cpf = docClean.slice(0, 11) || '11144477735'
  }

  console.log('[Efi Boleto] Creating charge:', JSON.stringify({ value: chargeData.value, dueDate: chargeData.dueDate, customer }))

  const notificationUrl = process.env.EFI_WEBHOOK_URL ?? 'https://tribocrm-production.up.railway.app/webhooks/efi'

  const charge = await efi.createOneStepCharge([] as any, {
    items: [{
      name: chargeData.description,
      value: Math.round(chargeData.value * 100),
      amount: 1,
    }],
    payment: {
      banking_billet: {
        expire_at: chargeData.dueDate,
        customer,
      },
    },
    metadata: {
      notification_url: notificationUrl,
    },
  } as any) as any

  console.log('[Efi Boleto] keys:', Object.keys(charge || {}))
  console.log('[Efi Boleto] Charge response:', JSON.stringify(charge, null, 2))

  // SDK returns object directly — no .data wrapper
  const chargeId = String(charge?.charge_id ?? charge?.data?.charge_id ?? Date.now())
  const boletoUrl = charge?.billet_link ?? charge?.pdf?.charge ?? charge?.data?.billet_link ?? ''
  const barCode = charge?.barcode ?? charge?.data?.barcode ?? ''

  // Save to database
  await prisma.charge.create({
    data: {
      tenantId,
      efiChargeId: chargeId,
      amount: chargeData.value,
      discountValue: chargeData.discountValue ?? null,
      dueDate: new Date(chargeData.dueDate),
      paymentMethod: 'BOLETO',
      status: 'PENDING',
      referenceMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    },
  })

  return {
    chargeId,
    boletoUrl,
    barCode,
    dueDate: chargeData.dueDate,
  }
}

// ── Status ──

export async function getChargeStatus(txid: string): Promise<{ status: string; paidAt: string | null; value: number }> {
  const charge = await prisma.charge.findFirst({
    where: { efiChargeId: txid },
  })

  if (!charge) throw new Error('Cobrança não encontrada')

  return {
    status: charge.status,
    paidAt: charge.paidAt?.toISOString() ?? null,
    value: Number(charge.amount),
  }
}

// ── Cancel ──

export async function cancelCharge(txid: string): Promise<void> {
  const charge = await prisma.charge.findFirst({
    where: { efiChargeId: txid, status: 'PENDING' },
  })

  if (!charge) throw new Error('Cobrança não encontrada ou já processada')

  await prisma.charge.update({
    where: { id: charge.id },
    data: { status: 'CANCELLED' },
  })
}

// ── Card Subscription ──
//
// Real recurring subscription flow (sub-etapa 6J.3). Uses the Efi
// oneStepSubscription endpoint against a pre-created plan on Efi's
// side — plan IDs come from EFI_PLAN_ID_MONTHLY / EFI_PLAN_ID_YEARLY
// env vars. Replaces the pre-6J stub that used createOneStepCharge
// with an empty payment_token and optimistically wrote Charge=PAID.
// Recurring events (renewal, payment confirmation) are delivered by
// Efi via the notification webhook handled in sub-etapa 6J.4.

export interface CardSubscriptionInput {
  tenantId: string
  paymentToken: string
  billingAddress: {
    street: string
    number: string
    neighborhood: string
    zipcode: string
    city: string
    state: string
    complement?: string
  }
  customer: {
    name: string
    email: string
    cpf: string
    birth?: string
    phone_number?: string
  }
}

export interface CardSubscriptionResult {
  subscriptionId: string
  chargeId: string
  status: string
  lastFour?: string
  brand?: string
  nextBillingAt?: Date
}

export async function createCardSubscription(input: CardSubscriptionInput): Promise<CardSubscriptionResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { plan: true },
  })
  if (!tenant) throw new Error('Tenant não encontrado')
  if (!tenant.plan) throw new Error('Tenant sem plano')

  // Best-effort cancel of a pre-existing active subscription — never
  // blocks the new signup. If the old one lingers on Efi's side the
  // operator sees the error in logs and can reconcile manually.
  if (tenant.efiSubscriptionId && tenant.efiSubscriptionStatus === 'ACTIVE') {
    try {
      await cancelCardSubscription(tenant.id)
      console.log(`[createCardSubscription] antiga ${tenant.efiSubscriptionId} cancelada antes de criar nova`)
    } catch (err: any) {
      console.error(`[createCardSubscription] falha ao cancelar antiga ${tenant.efiSubscriptionId}:`, err?.message)
    }
  }

  const planIdEnv = tenant.planCycle === 'YEARLY'
    ? process.env.EFI_PLAN_ID_YEARLY
    : process.env.EFI_PLAN_ID_MONTHLY

  if (!planIdEnv) {
    throw new Error(`EFI_PLAN_ID_${tenant.planCycle} não configurado`)
  }

  const planId = parseInt(planIdEnv, 10)
  if (isNaN(planId)) throw new Error('Plan ID Efi inválido')

  const price = tenant.planCycle === 'YEARLY'
    ? tenant.plan.priceYearly
    : tenant.plan.priceMonthly

  if (!price) throw new Error('Preço do plano não configurado')

  const valueInCents = Math.round(Number(price) * 100)

  const efi = getClient()

  const params = { id: planId }

  const body: any = {
    items: [{
      name: `TriboCRM ${tenant.plan.name} - ${tenant.planCycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
      value: valueInCents,
      amount: 1,
    }],
    payment: {
      credit_card: {
        installments: 1,
        payment_token: input.paymentToken,
        billing_address: {
          street: input.billingAddress.street,
          number: input.billingAddress.number,
          neighborhood: input.billingAddress.neighborhood,
          zipcode: input.billingAddress.zipcode.replace(/\D/g, ''),
          city: input.billingAddress.city,
          state: input.billingAddress.state,
          ...(input.billingAddress.complement
            ? { complement: input.billingAddress.complement }
            : {}),
        },
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          cpf: input.customer.cpf.replace(/\D/g, ''),
          ...(input.customer.birth ? { birth: input.customer.birth } : {}),
          ...(input.customer.phone_number
            ? { phone_number: input.customer.phone_number.replace(/\D/g, '') }
            : {}),
        },
      },
    },
  }

  let efiResponse: any
  try {
    efiResponse = await (efi as any).oneStepSubscription(params, body)
    console.log('[createCardSubscription] Efi response:', JSON.stringify(efiResponse).substring(0, 500))
  } catch (err: any) {
    console.error('[createCardSubscription] Efi error:', err?.message, err?.response?.data)
    throw new Error(`Falha ao criar assinatura na Efi: ${err?.message ?? 'erro desconhecido'}`)
  }

  const dataRoot = efiResponse?.data ?? efiResponse
  const subscriptionId = String(dataRoot?.subscription_id ?? '')
  const chargeId = String(dataRoot?.charge_id ?? '')
  const status = String(dataRoot?.status ?? 'new')

  if (!subscriptionId) {
    throw new Error('Efi não retornou subscription_id')
  }

  const now = new Date()
  const cycleDays = tenant.planCycle === 'YEARLY' ? 365 : 30
  const nextBillingAt = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: {
        efiSubscriptionId: subscriptionId,
        efiSubscriptionStatus: 'ACTIVE',
        cardLastFour: null,
        cardBrand: null,
        nextBillingAt,
        status: 'ACTIVE',
        trialEndsAt: null,
        planStartedAt: tenant.planStartedAt ?? now,
        planExpiresAt: nextBillingAt,
        lastBillingState: null,
        lastBillingStateAt: null,
      },
    })

    await tx.charge.create({
      data: {
        tenantId: tenant.id,
        efiChargeId: chargeId || null,
        efiSubscriptionId: subscriptionId,
        amount: price,
        paymentMethod: 'CREDIT_CARD',
        status: status === 'paid' ? 'PAID' : 'PENDING',
        dueDate: now,
        paidAt: status === 'paid' ? now : null,
        referenceMonth: now.toISOString().slice(0, 7),
      },
    })
  })

  return {
    subscriptionId,
    chargeId: chargeId || '',
    status,
    lastFour: undefined,
    brand: undefined,
    nextBillingAt,
  }
}

export async function cancelCardSubscription(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, efiSubscriptionId: true, efiSubscriptionStatus: true },
  })

  if (!tenant) throw new Error('Tenant não encontrado')
  if (!tenant.efiSubscriptionId) {
    console.warn(`[cancelCardSubscription] tenant ${tenantId} sem efiSubscriptionId, nothing to cancel`)
    return
  }

  const efi = getClient()

  try {
    await (efi as any).cancelSubscription({ id: parseInt(tenant.efiSubscriptionId, 10) })
    console.log(`[cancelCardSubscription] subscription ${tenant.efiSubscriptionId} cancelada na Efi`)
  } catch (err: any) {
    console.error(`[cancelCardSubscription] Efi error:`, err?.message, err?.response?.data)
    throw new Error(`Falha ao cancelar assinatura na Efi: ${err?.message ?? 'erro desconhecido'}`)
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      efiSubscriptionStatus: 'CANCELLED',
      nextBillingAt: null,
    },
  })
}

// ── Payment History ──

export async function getPaymentHistory(tenantId: string): Promise<any[]> {
  const charges = await prisma.charge.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return charges.map(c => ({
    id: c.id,
    efiChargeId: c.efiChargeId,
    amount: Number(c.amount),
    dueDate: c.dueDate.toISOString(),
    paidAt: c.paidAt?.toISOString() ?? null,
    paymentMethod: c.paymentMethod,
    status: c.status,
    referenceMonth: c.referenceMonth,
    createdAt: c.createdAt.toISOString(),
  }))
}

// ── Webhook Registration ──

const WEBHOOK_URL = process.env.EFI_WEBHOOK_URL ?? 'https://tribocrm-production.up.railway.app/webhooks/efi'

export async function registerPixWebhook(): Promise<{ url: string; warning?: string; pixKey: string }> {
  const pixKey = (process.env.EFI_PIX_KEY || '').replace(/[\.\-\/]/g, '')
  if (!pixKey) throw new Error('EFI_PIX_KEY not configured')

  console.log('[Efi] registerPixWebhook starting:', { pixKey: pixKey.slice(0, 6) + '***', webhookUrl: WEBHOOK_URL, sandbox: isSandbox })

  try {
    const efi = getClient()
    const result = await efi.pixConfigWebhook({ chave: pixKey } as any, { webhookUrl: WEBHOOK_URL } as any)
    console.log('[Efi] Webhook PIX registrado com sucesso:', WEBHOOK_URL, 'result:', JSON.stringify(result))
    return { url: WEBHOOK_URL, pixKey: pixKey.slice(0, 6) + '***' }
  } catch (err: any) {
    console.error('EFI_WEBHOOK_REGISTER_ERROR:', {
      message: err?.message,
      response: err?.response?.data ?? err?.data ?? null,
      status: err?.response?.status ?? err?.status ?? null,
      body: err?.body ?? null,
      name: err?.name ?? null,
      raw: (() => { try { return JSON.stringify(err, Object.getOwnPropertyNames(err)).slice(0, 2000) } catch { return String(err) } })(),
    })
    if (isSandbox) {
      const msg = 'Webhook PIX não disponível em sandbox — cobranças funcionam normalmente, confirmações devem ser verificadas manualmente'
      console.warn('[Efi]', msg)
      return { url: WEBHOOK_URL, warning: msg, pixKey: pixKey.slice(0, 6) + '***' }
    }
    // Re-throw with enriched message so the admin route returns useful info
    const detail = err?.response?.data ?? err?.data ?? err?.body
    const detailStr = detail ? ` — detail: ${JSON.stringify(detail).slice(0, 500)}` : ''
    const error = new Error(`${err?.message ?? 'Unknown Efi error'}${detailStr}`)
    ;(error as any).original = err
    throw error
  }
}

// ── Webhook Processing ──

export async function processWebhookPayment(efiId: string): Promise<{ ok: boolean; reason?: string; chargeId?: string; tenantId?: string }> {
  const charge = await prisma.charge.findFirst({
    where: { efiChargeId: efiId },
  })

  if (!charge) return { ok: false, reason: 'charge_not_found' }
  if (charge.status === 'PAID') return { ok: true, reason: 'already_paid', chargeId: charge.id, tenantId: charge.tenantId }

  await prisma.charge.update({
    where: { id: charge.id },
    data: { status: 'PAID', paidAt: new Date() },
  })

  // Activate tenant and extend billing period
  const tenant = await prisma.tenant.findUnique({ where: { id: charge.tenantId } })
  if (tenant) {
    const now = new Date()
    const cycleDays = tenant.planCycle === 'YEARLY' ? 365 : 30
    // Extend from current planExpiresAt if still valid, otherwise from now
    const baseDate = tenant.planExpiresAt && tenant.planExpiresAt > now ? tenant.planExpiresAt : now
    const nextExpiresAt = new Date(baseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000)

    // Track whether the payment is a recovery (vs. first-ever activation)
    // so the log picks up a clear "back from overdue" signal. Useful
    // both in Railway grep and on any future audit surface.
    const comebackFromOverdue = tenant.status === 'PAYMENT_OVERDUE'

    await prisma.tenant.update({
      where: { id: charge.tenantId },
      data: {
        status: 'ACTIVE',
        trialEndsAt: null,
        planStartedAt: tenant.planStartedAt ?? now,
        planExpiresAt: nextExpiresAt,
        // Clear billing-state-machine state so the next billing cycle
        // starts from scratch — otherwise a tenant that paid from
        // OVERDUE_D0_SENT would keep that marker and skip D-7/D-3/D-1
        // reminders on the next cycle.
        lastBillingState: null,
        lastBillingStateAt: null,
      },
    })

    if (comebackFromOverdue) {
      console.log(`[Webhook:efi] tenant ${charge.tenantId} recovered from PAYMENT_OVERDUE to ACTIVE (charge paid)`)
    }
  }

  return { ok: true, chargeId: charge.id, tenantId: charge.tenantId }
}

// ── Subscription Notification (sub-etapa 6J.4) ──
//
// Efi delivers subscription events as an opaque notification token
// (different from PIX/Boleto which ship the payload directly). The
// webhook router spots `{ notification: "<token>" }` payloads and
// hands them here; we resolve the token via SDK.getNotification,
// extract the latest event from the returned history, keep
// `tenant.efiSubscriptionStatus` in sync, ensure the local Charge
// row exists (idempotent — renewals create a new charge_id each
// cycle), and when the event is `status=paid` we delegate to
// processWebhookPayment so the extension of planExpiresAt, the
// lastBillingState cleanup and the OVERDUE-recovery log stay in a
// single place.

export interface SubscriptionNotificationResult {
  ok: boolean
  reason?: string
  subscriptionId?: string
  chargeId?: string
  tenantId?: string
}

export async function processSubscriptionNotification(
  token: string,
): Promise<SubscriptionNotificationResult> {
  const efi = getClient()
  let detail: any
  try {
    detail = await (efi as any).getNotification({ token })
    console.log(
      `[processSubscriptionNotification] token=${token.slice(0, 10)}... response:`,
      JSON.stringify(detail).substring(0, 500),
    )
  } catch (err: any) {
    console.error(
      '[processSubscriptionNotification] Efi getNotification failed:',
      err?.message,
      err?.response?.data,
    )
    return { ok: false, reason: 'getNotification_failed' }
  }

  const history = detail?.data ?? detail
  const latest = Array.isArray(history) ? history[history.length - 1] : history
  if (!latest) return { ok: false, reason: 'empty_notification' }

  const subIdRaw = latest?.identifiers?.subscription_id ?? latest?.subscription?.id
  const chargeIdRaw = latest?.identifiers?.charge_id ?? latest?.charge?.id
  const currentStatus = String(
    latest?.status?.current ?? latest?.status ?? '',
  ).toLowerCase()

  if (!subIdRaw) return { ok: false, reason: 'no_subscription_id' }
  const subId = String(subIdRaw)
  const chargeIdEfi = chargeIdRaw ? String(chargeIdRaw) : null

  const tenant = await prisma.tenant.findFirst({
    where: { efiSubscriptionId: subId },
    include: { plan: true },
  })
  if (!tenant) {
    return { ok: false, reason: 'tenant_not_found', subscriptionId: subId }
  }

  const subStatusMap: Record<string, string> = {
    new: 'ACTIVE',
    active: 'ACTIVE',
    paid: 'ACTIVE',
    waiting: 'ACTIVE',
    unpaid: 'OVERDUE',
    canceled: 'CANCELLED',
    refunded: 'CANCELLED',
  }
  const mapped = subStatusMap[currentStatus]

  if (!mapped && currentStatus) {
    console.warn(
      `[processSubscriptionNotification] status desconhecido '${currentStatus}' — ignorando update`,
    )
  }

  if (mapped && mapped !== tenant.efiSubscriptionStatus) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { efiSubscriptionStatus: mapped },
    })
    console.log(
      `[processSubscriptionNotification] tenant=${tenant.id} efiSubscriptionStatus: ${tenant.efiSubscriptionStatus} -> ${mapped}`,
    )
  }

  if (chargeIdEfi) {
    const existing = await prisma.charge.findFirst({
      where: { efiChargeId: chargeIdEfi },
    })

    if (!existing) {
      const price =
        tenant.planCycle === 'YEARLY'
          ? tenant.plan?.priceYearly
          : tenant.plan?.priceMonthly

      if (!price) {
        console.error(
          `[processSubscriptionNotification] tenant=${tenant.id} sem preço configurado`,
        )
        return {
          ok: false,
          reason: 'price_missing',
          subscriptionId: subId,
          chargeId: chargeIdEfi,
        }
      }

      const now = new Date()
      await prisma.charge.create({
        data: {
          tenantId: tenant.id,
          efiChargeId: chargeIdEfi,
          efiSubscriptionId: subId,
          amount: price,
          paymentMethod: 'CREDIT_CARD',
          status: 'PENDING',
          dueDate: now,
          referenceMonth: now.toISOString().slice(0, 7),
        },
      })
      console.log(
        `[processSubscriptionNotification] criada charge efiChargeId=${chargeIdEfi} pra tenant=${tenant.id}`,
      )
    }
  }

  if (currentStatus === 'paid' && chargeIdEfi) {
    const result = await processWebhookPayment(chargeIdEfi)
    return {
      ok: result.ok,
      reason: result.reason,
      subscriptionId: subId,
      chargeId: chargeIdEfi,
      tenantId: tenant.id,
    }
  }

  return {
    ok: true,
    reason: `status=${currentStatus || 'unknown'}`,
    subscriptionId: subId,
    chargeId: chargeIdEfi ?? undefined,
    tenantId: tenant.id,
  }
}
