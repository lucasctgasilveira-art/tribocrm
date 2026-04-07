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
  value: number // em reais (ex: 349.00)
  description: string
  expiresIn?: number // segundos, padrão 1800 (30min)
  debtorName: string
  debtorCpf: string
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
}

interface BoletoChargeResult {
  chargeId: string
  boletoUrl: string
  barCode: string
  dueDate: string
}

export async function createBoletoCharge(tenantId: string, chargeData: BoletoChargeData): Promise<BoletoChargeResult> {
  const efi = getClient()
  const cpfClean = chargeData.debtorCpf.replace(/\D/g, '')

  // Always use pessoa física (CPF) for boleto — avoids "same CNPJ as receiver" error
  const customer: any = {
    name: chargeData.debtorName,
    email: chargeData.debtorEmail,
    cpf: cpfClean.slice(0, 11) || '11144477735',
  }

  console.log('[Efi Boleto] Creating charge:', JSON.stringify({ value: chargeData.value, dueDate: chargeData.dueDate, customer }))

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

interface CardData {
  cardNumber: string
  holderName: string
  expirationMonth: string
  expirationYear: string
  cvv: string
  value: number
  description: string
  customerName: string
  customerCpf: string
  customerEmail: string
}

export async function createCardSubscription(tenantId: string, cardData: CardData): Promise<{ chargeId: string; status: string; lastFour: string }> {
  const efi = getClient()
  const cpfClean = cardData.customerCpf.replace(/\D/g, '') || '11144477735'

  const charge = await efi.createOneStepCharge([] as any, {
    items: [{ name: cardData.description, value: Math.round(cardData.value * 100), amount: 1 }],
    payment: {
      credit_card: {
        installments: 1,
        payment_token: '', // In production, generate via Efi.js frontend tokenizer
        billing_address: { street: 'Não informado', number: '0', neighborhood: 'Centro', zipcode: '01000000', city: 'São Paulo', state: 'SP' },
        customer: { name: cardData.customerName, cpf: cpfClean, email: cardData.customerEmail },
      },
    },
  } as any) as any

  const chargeId = String(charge?.charge_id ?? Date.now())

  await prisma.charge.create({
    data: {
      tenantId,
      efiChargeId: chargeId,
      amount: cardData.value,
      dueDate: new Date(),
      paymentMethod: 'CREDIT_CARD',
      status: 'PAID',
      paidAt: new Date(),
      referenceMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    },
  })

  return { chargeId, status: 'PAID', lastFour: cardData.cardNumber.slice(-4) }
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

const WEBHOOK_URL = 'https://tribocrm-production.up.railway.app/payments/webhook/efi'

export async function registerPixWebhook(): Promise<{ url: string; warning?: string }> {
  const pixKey = process.env.EFI_PIX_KEY ?? ''
  if (!pixKey) throw new Error('EFI_PIX_KEY not configured')

  try {
    const efi = getClient()
    await efi.pixConfigWebhook({ chave: pixKey } as any, { webhookUrl: WEBHOOK_URL } as any)
    console.log('[Efi] Webhook PIX registrado com sucesso:', WEBHOOK_URL)
    return { url: WEBHOOK_URL }
  } catch (err: any) {
    if (isSandbox) {
      const msg = 'Webhook PIX não disponível em sandbox — cobranças funcionam normalmente, confirmações devem ser verificadas manualmente'
      console.warn('[Efi]', msg)
      return { url: WEBHOOK_URL, warning: msg }
    }
    throw err
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

    await prisma.tenant.update({
      where: { id: charge.tenantId },
      data: {
        status: 'ACTIVE',
        trialEndsAt: null,
        planStartedAt: tenant.planStartedAt ?? now,
        planExpiresAt: nextExpiresAt,
      },
    })
  }

  return { ok: true, chargeId: charge.id, tenantId: charge.tenantId }
}
