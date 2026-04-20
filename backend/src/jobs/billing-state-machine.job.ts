import { prisma } from '../lib/prisma'
import { sendTemplateMail } from '../services/mailer.service'
import { BILLING_TEMPLATES } from '../config/billing-templates'
import { createPixCharge, createBoletoCharge } from '../services/efi.service'

// Billing state machine — TRIAL side (sub-etapa 6C).
//
// Runs daily and walks every tenant in TRIAL, sending the pre-expiry
// reminder email at D-7 / D-3 / D-1 and flagging TRIAL_EXPIRED once
// trialEndsAt passes. Never sends multiple emails in the same run:
// only the most advanced applicable marker fires. Idempotency comes
// from `tenant.lastBillingState` — once set to 'TRIAL_D7_SENT' etc.,
// the tenant is skipped on the next run unless it progresses.
//
// OVERDUE / SUSPENSION lanes are out of scope for 6C — they land in
// 6E along with the charge-generation logic.

type BillingState = 'TRIAL_D7_SENT' | 'TRIAL_D3_SENT' | 'TRIAL_D1_SENT' | 'TRIAL_EXPIRED'

// ── Pure formatting helpers (no I/O, easy to unit-test in 6K) ──

function formatBR(decimal: unknown): string {
  return Number(decimal).toFixed(2).replace('.', ',')
}

function formatValor(
  priceMonthly: unknown,
  priceYearly: unknown,
  planCycle: string | null,
  paymentMethod: string | null,
): string {
  if (planCycle === 'MONTHLY') {
    return `R$ ${formatBR(priceMonthly)}/mês`
  }
  // YEARLY
  if (paymentMethod === 'CREDIT_CARD') {
    const parcela = Number(priceYearly) / 12
    return `12× de R$ ${formatBR(parcela)} no cartão`
  }
  // PIX ou BOLETO anual
  return `R$ ${formatBR(priceYearly)} à vista`
}

function formatMetodo(method: string | null): string {
  if (!method) return '-'
  const map: Record<string, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de crédito',
  }
  return map[method] ?? method
}

function formatDataBR(date: Date | null): string {
  if (!date) return '-'
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const y = date.getUTCFullYear()
  return `${d}/${m}/${y}`
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return 'Olá'
  return fullName.trim().split(' ')[0] || 'Olá'
}

// Days between `now` and `target` normalized to UTC midnight so the
// calc doesn't drift across the America/Sao_Paulo DST transitions.
function daysUntil(target: Date, now: Date): number {
  const MS = 1000 * 60 * 60 * 24
  const nowMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const targetMidnight = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))
  return Math.round((targetMidnight.getTime() - nowMidnight.getTime()) / MS)
}

// ── Charge generation (sub-etapa 6D) ──
//
// Called only for tenants crossing into the D-3 window. Generates a
// PIX or Boleto charge via efi.service (which persists to the Charge
// table itself) so that by the time the D-3 email lands, the customer
// already has something to pay on /gestao/assinatura. CREDIT_CARD
// is deferred to sub-etapa 6J (recurring billing). Never throws —
// returns a structured result the caller logs/counts. Email delivery
// continues regardless of charge success.

interface ChargeResult {
  success: boolean
  chargeId?: string
  reason?: string
}

function calcAmountForCharge(
  priceMonthly: unknown,
  priceYearly: unknown,
  planCycle: string | null,
): number | null {
  if (planCycle === 'MONTHLY') {
    return Number(priceMonthly)
  }
  if (planCycle === 'YEARLY') {
    return Number(priceYearly)
  }
  return null
}

// Returns the debtor document (digits only, 11 or 14 chars) when the
// tenant has a valid CPF/CNPJ; null when only the legacy `cnpj`
// placeholder is present (pre-5F tenants).
function getValidDocument(tenant: { document?: string | null; cnpj?: string | null }): string | null {
  const raw = (tenant.document ?? tenant.cnpj ?? '').toString().replace(/\D/g, '')
  if (raw.length === 11 || raw.length === 14) return raw
  return null
}

async function generateChargeForTrialEnd(tenant: {
  id: string
  name: string
  tradeName: string | null
  trialEndsAt: Date | null
  planCycle: string | null
  preferredPaymentMethod: string | null
  document?: string | null
  cnpj?: string | null
  addressStreet: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
  plan: { name: string; priceMonthly: unknown; priceYearly: unknown } | null
  users: Array<{ email: string }>
}): Promise<ChargeResult> {
  const method = tenant.preferredPaymentMethod

  if (!method) {
    return { success: false, reason: 'no_payment_method' }
  }
  if (method === 'CREDIT_CARD') {
    return { success: false, reason: 'credit_card_deferred_to_6J' }
  }

  // Idempotency — if a PENDING charge with a future dueDate exists,
  // the previous run (or an admin-created one) already covers this
  // customer. Don't duplicate.
  const existing = await prisma.charge.findFirst({
    where: {
      tenantId: tenant.id,
      status: 'PENDING',
      dueDate: { gte: new Date() },
    },
    select: { id: true },
  })
  if (existing) {
    return { success: false, reason: 'charge_already_exists', chargeId: existing.id }
  }

  const amount = calcAmountForCharge(
    tenant.plan?.priceMonthly,
    tenant.plan?.priceYearly,
    tenant.planCycle,
  )
  if (!amount || amount <= 0) {
    return { success: false, reason: 'invalid_amount' }
  }

  const now = new Date()
  const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const description = `TriboCRM - Plano ${tenant.plan?.name ?? 'N/A'} - ${referenceMonth}`

  try {
    if (method === 'PIX') {
      const validDoc = getValidDocument(tenant)
      const result = await createPixCharge(tenant.id, {
        value: amount,
        description,
        expiresIn: 604800, // 7 days — if Efi rejects, error is logged and retried next run
        // Only include debtor when we actually have a 11/14-digit doc.
        // Pre-5F tenants with the `P<17hex>` cnpj placeholder ship
        // without a debtor block (Efi accepts).
        ...(validDoc ? {
          debtorName: tenant.tradeName ?? tenant.name,
          debtorCpf: validDoc,
        } : {}),
      } as Parameters<typeof createPixCharge>[1])
      return { success: true, chargeId: result.txid }
    }

    if (method === 'BOLETO') {
      if (!tenant.trialEndsAt) {
        // Should be unreachable — caller already guards on this.
        return { success: false, reason: 'no_trial_ends_at' }
      }
      // dueDate = trialEndsAt + 7 days, formato YYYY-MM-DD.
      const due = new Date(tenant.trialEndsAt)
      due.setDate(due.getDate() + 7)
      const dueDateStr = due.toISOString().split('T')[0]!

      const owner = tenant.users[0]
      if (!owner) {
        return { success: false, reason: 'no_owner_for_boleto' }
      }

      const result = await createBoletoCharge(tenant.id, {
        value: amount,
        description,
        dueDate: dueDateStr,
        debtorName: tenant.tradeName ?? tenant.name,
        // Legacy `debtorCpf` kept for Efi envelope sanity; the newer
        // `document` field takes precedence inside efi.service when
        // present.
        debtorCpf: getValidDocument(tenant) ?? '',
        debtorEmail: owner.email,
        // Same fallbacks as admin.routes.ts:155-158 — pre-5D tenants
        // have null addresses and we mirror the admin flow instead of
        // failing the charge.
        debtorStreet: tenant.addressStreet || 'N/A',
        debtorCity: tenant.addressCity || 'São Paulo',
        debtorState: tenant.addressState || 'SP',
        debtorZipCode: tenant.addressZip || '01000000',
        document: getValidDocument(tenant) ?? undefined,
      })
      return { success: true, chargeId: result.chargeId }
    }

    return { success: false, reason: `unsupported_method_${method}` }
  } catch (err: any) {
    return {
      success: false,
      reason: `efi_error: ${err?.message ?? String(err)}`,
    }
  }
}

export async function runBillingStateMachineJob(): Promise<void> {
  console.log('[BillingStateMachine] starting…')
  const startedAt = Date.now()

  const now = new Date()

  // Tenant has no deletedAt column (unlike User/Lead) — status filter
  // alone already excludes CANCELLED tenants we don't want to touch.
  const tenants = await prisma.tenant.findMany({
    where: { status: 'TRIAL' },
    select: {
      id: true,
      name: true,
      tradeName: true,
      cnpj: true,
      document: true,
      trialEndsAt: true,
      planCycle: true,
      preferredPaymentMethod: true,
      addressStreet: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      lastBillingState: true,
      plan: {
        select: {
          name: true,
          priceMonthly: true,
          priceYearly: true,
        },
      },
      users: {
        where: {
          role: 'OWNER',
          deletedAt: null,
          isActive: true,
        },
        select: { id: true, name: true, email: true },
      },
    },
  })

  let processed = 0
  let sent = 0
  let skippedNoOwner = 0
  let flaggedExpired = 0
  let errors = 0
  let chargesGenerated = 0
  let chargesSkipped = 0
  let chargesFailed = 0

  for (const tenant of tenants) {
    try {
      processed++

      if (!tenant.trialEndsAt) {
        // Tenant in TRIAL without an end date — signup path always sets
        // it, so this is an anomaly. Log and move on.
        console.warn(`[BillingStateMachine] tenant ${tenant.id} has status=TRIAL but no trialEndsAt, skipping`)
        continue
      }

      const diasRestantes = daysUntil(tenant.trialEndsAt, now)

      // Pick the single most advanced applicable marker — never fire
      // two emails in the same run.
      let targetState: BillingState | null = null
      let templateId: number | null = null
      let templateDaysLeft: number | null = null

      if (diasRestantes < 0) {
        // Trial expired — only flag state. 6E will generate the charge
        // and move status to PAYMENT_OVERDUE.
        if (tenant.lastBillingState !== 'TRIAL_EXPIRED') {
          targetState = 'TRIAL_EXPIRED'
          // no template, no email
        }
      } else if (diasRestantes <= 1) {
        if (!['TRIAL_D1_SENT', 'TRIAL_EXPIRED'].includes(tenant.lastBillingState ?? '')) {
          targetState = 'TRIAL_D1_SENT'
          templateId = BILLING_TEMPLATES.TRIAL_D1
          templateDaysLeft = 1
        }
      } else if (diasRestantes <= 3) {
        if (!['TRIAL_D3_SENT', 'TRIAL_D1_SENT', 'TRIAL_EXPIRED'].includes(tenant.lastBillingState ?? '')) {
          targetState = 'TRIAL_D3_SENT'
          templateId = BILLING_TEMPLATES.TRIAL_D3
          templateDaysLeft = 3
        }
      } else if (diasRestantes <= 7) {
        if (!['TRIAL_D7_SENT', 'TRIAL_D3_SENT', 'TRIAL_D1_SENT', 'TRIAL_EXPIRED'].includes(tenant.lastBillingState ?? '')) {
          targetState = 'TRIAL_D7_SENT'
          templateId = BILLING_TEMPLATES.TRIAL_D7
          templateDaysLeft = 7
        }
      }

      if (!targetState) continue // Nothing to do this run.

      // Expired path — flag without sending email.
      if (targetState === 'TRIAL_EXPIRED') {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            lastBillingState: 'TRIAL_EXPIRED',
            lastBillingStateAt: new Date(),
          },
        })
        flaggedExpired++
        console.log(`[BillingStateMachine] tenant ${tenant.id} flagged as TRIAL_EXPIRED`)
        continue
      }

      // Email path — needs an active owner. If none, skip without
      // touching lastBillingState so the next run can retry once the
      // owner is reactivated or another is added.
      const owner = tenant.users[0]
      if (!owner || !owner.email) {
        console.warn(`[BillingStateMachine] tenant ${tenant.id} has no active OWNER, skipping (lastBillingState preserved as null)`)
        skippedNoOwner++
        continue
      }

      // D-3 only: generate PIX/Boleto charge BEFORE the email goes
      // out, so the customer hits /gestao/assinatura already with
      // something to pay. A failure here never blocks the email —
      // customer still gets the reminder and the next run retries.
      if (targetState === 'TRIAL_D3_SENT') {
        const chargeResult = await generateChargeForTrialEnd(tenant)
        if (chargeResult.success) {
          chargesGenerated++
          console.log(`[BillingStateMachine] charge generated for tenant=${tenant.id} chargeId=${chargeResult.chargeId}`)
        } else if (chargeResult.reason === 'charge_already_exists') {
          chargesSkipped++
          console.log(`[BillingStateMachine] charge already exists for tenant=${tenant.id}, skipping (chargeId=${chargeResult.chargeId})`)
        } else if (chargeResult.reason === 'no_payment_method') {
          chargesSkipped++
          console.warn(`[BillingStateMachine] tenant ${tenant.id} has no preferredPaymentMethod, charge skipped`)
        } else if (chargeResult.reason === 'credit_card_deferred_to_6J') {
          chargesSkipped++
          console.log(`[BillingStateMachine] tenant ${tenant.id} uses CREDIT_CARD (deferred to 6J), charge skipped`)
        } else {
          chargesFailed++
          console.error(`[BillingStateMachine] charge generation failed for tenant=${tenant.id} reason=${chargeResult.reason}`)
        }
      }

      const params = {
        nome: getFirstName(owner.name),
        plano: tenant.plan?.name ?? '-',
        valor: formatValor(
          tenant.plan?.priceMonthly,
          tenant.plan?.priceYearly,
          tenant.planCycle,
          tenant.preferredPaymentMethod,
        ),
        metodoPagamento: formatMetodo(tenant.preferredPaymentMethod),
        dataVencimento: formatDataBR(tenant.trialEndsAt),
        diasRestantes: templateDaysLeft!,
        linkPlano: 'https://app.tribocrm.com.br/gestao/assinatura',
      }

      const result = await sendTemplateMail({
        to: owner.email,
        templateId: templateId!,
        params,
      })

      if (!result.sent) {
        console.error(`[BillingStateMachine] failed to send email to tenant=${tenant.id} owner=${owner.email} reason=${result.reason} error=${result.error}`)
        errors++
        // Leave lastBillingState untouched so next run retries.
        continue
      }

      // Accepted risk: email sent OK but update may fail → tenant
      // could get the same email twice. Consistent with expiry-alert.job.
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          lastBillingState: targetState,
          lastBillingStateAt: new Date(),
        },
      })
      sent++
      console.log(`[BillingStateMachine] sent ${targetState} to tenant=${tenant.id} owner=${owner.email}`)
    } catch (err: any) {
      console.error(`[BillingStateMachine] unexpected error on tenant ${tenant.id}: ${err?.message ?? err}`)
      errors++
    }
  }

  const duration = Date.now() - startedAt
  console.log(
    `[BillingStateMachine] done in ${duration}ms: ` +
    `processed=${processed} sent=${sent} flaggedExpired=${flaggedExpired} ` +
    `skippedNoOwner=${skippedNoOwner} errors=${errors} ` +
    `chargesGenerated=${chargesGenerated} chargesSkipped=${chargesSkipped} chargesFailed=${chargesFailed}`,
  )
}
