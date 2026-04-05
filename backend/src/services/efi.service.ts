import EfiPay from 'sdk-typescript-apis-efi'
import { prisma } from '../lib/prisma'

function getClient(): EfiPay {
  return new EfiPay({
    client_id: process.env.EFI_CLIENT_ID!,
    client_secret: process.env.EFI_CLIENT_SECRET!,
    sandbox: process.env.EFI_SANDBOX === 'true',
  })
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
  const valueCents = Math.round(chargeData.value * 100).toString().padStart(1, '0')
  const valueStr = `${Math.floor(chargeData.value)}.${(valueCents.slice(-2)).padStart(2, '0')}`

  // Create immediate charge (cob)
  const cob = await efi.pixCreateImmediateCharge({ txid } as any, {
    calendario: { expiracao: expiresIn },
    devedor: { cpf: chargeData.debtorCpf.replace(/\D/g, ''), nome: chargeData.debtorName },
    valor: { original: valueStr },
    chave: process.env.EFI_PIX_KEY ?? '',
    solicitacaoPagador: chargeData.description,
  } as any) as any

  // Generate QR Code
  const qr = await efi.pixGenerateQRCode({ id: cob.loc.id } as any) as any

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
    pixCopiaECola: qr.qrcode ?? cob.pixCopiaECola ?? '',
    qrCode: qr.imagemQrcode ?? '',
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

  // Step 1: Create charge
  const charge = await efi.createOneStepCharge([] as any, {
    items: [{
      name: chargeData.description,
      value: Math.round(chargeData.value * 100),
      amount: 1,
    }],
    payment: {
      banking_billet: {
        expire_at: chargeData.dueDate,
        customer: {
          name: chargeData.debtorName,
          cpf: chargeData.debtorCpf.replace(/\D/g, ''),
          email: chargeData.debtorEmail,
        },
      },
    },
  } as any) as any

  const chargeId = String(charge.data?.charge_id ?? charge.charge_id ?? Date.now())
  const boletoUrl = charge.data?.billet_link ?? charge.data?.pdf?.charge ?? ''
  const barCode = charge.data?.barcode ?? ''

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

// ── Webhook Registration ──

const WEBHOOK_URL = 'https://tribocrm-production.up.railway.app/payments/webhook/efi'

export async function registerPixWebhook(): Promise<{ url: string }> {
  const efi = getClient()
  const pixKey = process.env.EFI_PIX_KEY ?? ''

  if (!pixKey) throw new Error('EFI_PIX_KEY not configured')

  await efi.pixConfigWebhook({ chave: pixKey } as any, { webhookUrl: WEBHOOK_URL } as any)

  return { url: WEBHOOK_URL }
}

// ── Webhook Processing ──

export async function processWebhookPayment(txid: string): Promise<void> {
  const charge = await prisma.charge.findFirst({
    where: { efiChargeId: txid },
  })

  if (!charge || charge.status === 'PAID') return

  await prisma.charge.update({
    where: { id: charge.id },
    data: { status: 'PAID', paidAt: new Date() },
  })

  // Activate tenant subscription if needed
  await prisma.tenant.update({
    where: { id: charge.tenantId },
    data: { status: 'ACTIVE' },
  })
}
