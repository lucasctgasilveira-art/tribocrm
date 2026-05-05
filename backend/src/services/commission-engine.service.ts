import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Engine de comissões do programa de parceiros.
 *
 * Responsabilidades:
 *   1. Gerar códigos únicos pra parceiros (PRT + 8 hex).
 *   2. Validar auto-indicação (parceiro não pode ser cliente do próprio CNPJ/email).
 *   3. Criar PartnerCommission quando uma cobrança vira PAID, se o
 *      tenant indicado tem partner ativo. Idempotente via @@unique
 *      em chargeId.
 *   4. Promover comissões PENDING → AVAILABLE quando passam 30 dias
 *      (chamado pelo cron commission-availability).
 *
 * Tudo aqui é fire-and-forget do ponto de vista de quem chama —
 * exceções são logadas mas não propagadas (nunca trava signup ou
 * pagamento se a comissão der ruim).
 */

// 30 dias de carência. Após esse prazo, comissão vira AVAILABLE.
// Se cliente cancelar/reembolsar dentro da carência, marcamos REVERSED.
// Após carência: sem reversão (parceiro já "ganhou").
const RETENTION_DAYS = 30

/**
 * Gera um código único pra parceiro: PRT + 8 chars hex (uppercase).
 * Tenta até 5 vezes em caso de colisão (probabilidade astronômica
 * de 1/4 bilhões — defensivo só por consciência).
 */
export async function generatePartnerCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const random = crypto.randomBytes(4).toString('hex').toUpperCase()
    const code = `PRT${random}`
    const existing = await prisma.partner.findUnique({
      where: { code },
      select: { id: true },
    })
    if (!existing) return code
  }
  throw new Error('Falha ao gerar código único de parceiro após 5 tentativas')
}

/**
 * Valida que tenant não está usando código do próprio parceiro.
 * Compara document (CPF/CNPJ digits-only) e email. Se qualquer
 * coincidir, é auto-indicação e bloqueia.
 *
 * Retorna { valid: boolean, reason?: string }.
 */
export async function validateNotSelfReferral(
  tenantId: string,
  partnerId: string,
): Promise<{ valid: boolean; reason?: string }> {
  const [tenant, partner] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { document: true, email: true },
    }),
    prisma.partner.findUnique({
      where: { id: partnerId },
      select: { document: true, email: true },
    }),
  ])

  if (!tenant || !partner) {
    return { valid: false, reason: 'Tenant ou parceiro não encontrado' }
  }

  // Compara documents (digits-only, case insensitive não importa pra digits)
  if (tenant.document && partner.document) {
    const tenantDoc = tenant.document.replace(/\D/g, '')
    const partnerDoc = partner.document.replace(/\D/g, '')
    if (tenantDoc && partnerDoc && tenantDoc === partnerDoc) {
      return { valid: false, reason: 'Não é permitido usar código do próprio CNPJ/CPF' }
    }
  }

  // Compara emails (case-insensitive)
  if (tenant.email && partner.email) {
    if (tenant.email.toLowerCase() === partner.email.toLowerCase()) {
      return { valid: false, reason: 'Não é permitido usar código com o mesmo e-mail cadastrado' }
    }
  }

  return { valid: true }
}

/**
 * Cria PartnerCommission pra uma cobrança que acabou de virar PAID.
 *
 * Regras:
 *   - Cobrança precisa ter status=PAID e paidAt setado.
 *   - Tenant da cobrança precisa ter referredByPartnerId setado.
 *   - Parceiro precisa estar ativo (isActive=true) NO MOMENTO do PAID
 *     — comissão "fica congelada" no tempo: parceiro inativado depois
 *     não retroage.
 *   - Se já existe commission pra esse chargeId (@@unique), no-op.
 *   - rate é congelado no momento da criação (parceiro pode mudar %
 *     no futuro — comissões antigas mantêm o original).
 *
 * Nunca lança — log estruturado em caso de erro. Quem chama (hook
 * do webhook Efi) segue em frente.
 */
export async function createCommissionForCharge(chargeId: string): Promise<void> {
  try {
    const charge = await prisma.charge.findUnique({
      where: { id: chargeId },
      select: {
        id: true,
        tenantId: true,
        amount: true,
        status: true,
        paidAt: true,
      },
    })

    if (!charge) {
      console.warn(`[CommissionEngine] charge ${chargeId} não encontrada`)
      return
    }
    if (charge.status !== 'PAID' || !charge.paidAt) {
      console.warn(`[CommissionEngine] charge ${chargeId} não está PAID (status=${charge.status})`)
      return
    }

    // Verifica idempotência ANTES de buscar parceiro — economiza queries
    const existing = await prisma.partnerCommission.findUnique({
      where: { chargeId },
      select: { id: true },
    })
    if (existing) {
      console.log(`[CommissionEngine] charge ${chargeId} já tem commission ${existing.id}, no-op`)
      return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: charge.tenantId },
      select: {
        id: true,
        referredByPartnerId: true,
        referredBy: {
          select: { id: true, isActive: true, commissionRate: true },
        },
      },
    })

    if (!tenant) {
      console.warn(`[CommissionEngine] tenant ${charge.tenantId} não encontrado`)
      return
    }
    if (!tenant.referredByPartnerId || !tenant.referredBy) {
      // Sem parceiro indicador — é o caso comum, não loga.
      return
    }
    if (!tenant.referredBy.isActive) {
      console.log(
        `[CommissionEngine] tenant ${charge.tenantId} indicado pelo parceiro ` +
        `${tenant.referredByPartnerId}, mas parceiro está INATIVO — sem commission`,
      )
      return
    }

    const rate = tenant.referredBy.commissionRate
    const amount = charge.amount
    // commission = amount * rate / 100, arredondado pra 2 casas
    const commissionValue = new Prisma.Decimal(amount.toString())
      .mul(rate.toString())
      .div(100)
      .toDecimalPlaces(2)
    const availableAt = new Date(charge.paidAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000)

    await prisma.partnerCommission.create({
      data: {
        partnerId: tenant.referredByPartnerId,
        tenantId: charge.tenantId,
        chargeId: charge.id,
        amount,
        rate,
        commission: commissionValue,
        status: 'PENDING',
        availableAt,
      },
    })

    console.log(
      `[CommissionEngine] commission criada — charge=${charge.id} ` +
      `tenant=${charge.tenantId} partner=${tenant.referredByPartnerId} ` +
      `amount=${amount} rate=${rate} commission=${commissionValue} availableAt=${availableAt.toISOString()}`,
    )
  } catch (err: any) {
    // Nunca lança — falha de comissão NUNCA pode afetar o fluxo de
    // pagamento ou o webhook da Efi.
    console.error(`[CommissionEngine] createCommissionForCharge ${chargeId} error:`, {
      code: err?.code,
      message: err?.message,
    })
  }
}

/**
 * Promove comissões PENDING → AVAILABLE quando passam da janela de
 * carência. Chamado pelo cron commission-availability diariamente.
 *
 * Retorna { promoted } pra log do job.
 */
export async function promoteAvailableCommissions(): Promise<{ promoted: number }> {
  const now = new Date()
  const result = await prisma.partnerCommission.updateMany({
    where: {
      status: 'PENDING',
      availableAt: { lte: now },
    },
    data: {
      status: 'AVAILABLE',
    },
  })
  return { promoted: result.count }
}
