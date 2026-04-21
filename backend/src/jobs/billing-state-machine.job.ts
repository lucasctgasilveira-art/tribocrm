import { prisma } from '../lib/prisma'
import { sendTemplateMail } from '../services/mailer.service'
import { BILLING_TEMPLATES } from '../config/billing-templates'
import { createPixCharge, createBoletoCharge } from '../services/efi.service'

// Billing state machine — TRIAL + OVERDUE + SUSPENSION lanes
// (sub-etapas 6C / 6D / 6E / 6F).
//
// Runs daily over every tenant in TRIAL or PAYMENT_OVERDUE:
//   • Pre-expiry reminders at D-7 / D-3 / D-1 while still in TRIAL.
//   • Charge generation at D-3 (via generateChargeForTrialEnd).
//   • Crossing the trial end → sends OVERDUE D+0 email + transitions
//     TRIAL → PAYMENT_OVERDUE in the same update.
//   • Once OVERDUE for 7+ days → sends last-warning D+7 email.
//   • Once OVERDUE for 10+ days → sends D+10 email + transitions
//     PAYMENT_OVERDUE → SUSPENDED in the same update.
//
// Idempotency is anchored in `tenant.lastBillingState` — once set to
// 'TRIAL_D7_SENT' / 'OVERDUE_D0_SENT' etc., the tenant is skipped on
// the next run unless it progresses to the next marker. The string
// literal 'TRIAL_EXPIRED' is still honoured in comparisons for
// backwards compatibility with tenants flagged by the pre-6E job.

type BillingState =
  | 'TRIAL_D7_SENT'
  | 'TRIAL_D3_SENT'
  | 'TRIAL_D1_SENT'
  | 'OVERDUE_D0_SENT'
  | 'OVERDUE_D7_SENT'
  | 'SUSPENDED_D10_SENT'

// ── Pure formatting helpers (no I/O, easy to unit-test in 6K) ──

function formatBR(decimal: unknown): string {
  return Number(decimal).toFixed(2).replace('.', ',')
}

export function formatValor(
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

export function formatMetodo(method: string | null): string {
  if (!method) return '-'
  const map: Record<string, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de crédito',
  }
  return map[method] ?? method
}

export function formatDataBR(date: Date | null): string {
  if (!date) return '-'
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const y = date.getUTCFullYear()
  return `${d}/${m}/${y}`
}

export function getFirstName(fullName: string | null): string {
  if (!fullName) return 'Olá'
  return fullName.trim().split(' ')[0] || 'Olá'
}

// Days between `now` and `target` normalized to UTC midnight so the
// calc doesn't drift across the America/Sao_Paulo DST transitions.
export function daysUntil(target: Date, now: Date): number {
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
  addressNumber: string | null
  addressNeighborhood: string | null
  addressComplement: string | null
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
        // Pre-5D tenants têm endereço null — passamos undefined e
        // createBoletoCharge omite o bloco customer.address inteiro
        // em vez de inventar dados falsos.
        debtorStreet: tenant.addressStreet ?? undefined,
        debtorCity: tenant.addressCity ?? undefined,
        debtorState: tenant.addressState ?? undefined,
        debtorZipCode: tenant.addressZip ?? undefined,
        debtorNumber: tenant.addressNumber ?? undefined,
        debtorNeighborhood: tenant.addressNeighborhood ?? undefined,
        debtorComplement: tenant.addressComplement ?? undefined,
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

// Each Brevo template expects a different param shape; keeping the
// branching in a helper keeps the main loop readable. Keys match the
// placeholders Lucas configured in each template's HTML.
export function buildParamsForState(
  targetState: BillingState,
  tenant: {
    tradeName: string | null
    name: string
    trialEndsAt: Date | null
    planCycle: string | null
    preferredPaymentMethod: string | null
    plan: { name: string; priceMonthly: unknown; priceYearly: unknown } | null
  },
  owner: { name: string },
): Record<string, string | number> {
  const baseValor = formatValor(
    tenant.plan?.priceMonthly,
    tenant.plan?.priceYearly,
    tenant.planCycle,
    tenant.preferredPaymentMethod,
  )
  const nome = getFirstName(owner.name)
  const dataVencimento = formatDataBR(tenant.trialEndsAt)

  if (targetState === 'SUSPENDED_D10_SENT') {
    // Template #7 — account suspended, same shape as D+7.
    return {
      nome,
      valor: baseValor,
      dataVencimento,
      linkPagamento: 'https://app.tribocrm.com.br/gestao/assinatura',
      linkContato: 'https://app.tribocrm.com.br/gestao/assinatura',
    }
  }

  if (targetState === 'OVERDUE_D7_SENT') {
    // Template #6 — last-warning email, minimal payload.
    return {
      nome,
      valor: baseValor,
      dataVencimento,
      linkPagamento: 'https://app.tribocrm.com.br/gestao/assinatura',
      linkContato: 'https://app.tribocrm.com.br/gestao/assinatura',
    }
  }

  if (targetState === 'OVERDUE_D0_SENT') {
    // Template #5 — trial ended today, payment is overdue.
    return {
      nome,
      plano: tenant.plan?.name ?? '-',
      valor: baseValor,
      metodoPagamento: formatMetodo(tenant.preferredPaymentMethod),
      dataVencimento,
      linkPagamento: 'https://app.tribocrm.com.br/gestao/assinatura',
    }
  }

  // Pre-expiry templates (D-7 / D-3 / D-1) share the same shape.
  const daysMap: Record<string, number> = {
    TRIAL_D7_SENT: 7,
    TRIAL_D3_SENT: 3,
    TRIAL_D1_SENT: 1,
  }
  return {
    nome,
    plano: tenant.plan?.name ?? '-',
    valor: baseValor,
    metodoPagamento: formatMetodo(tenant.preferredPaymentMethod),
    dataVencimento,
    diasRestantes: daysMap[targetState] ?? 0,
    linkPlano: 'https://app.tribocrm.com.br/gestao/assinatura',
  }
}

export async function runBillingStateMachineJob(): Promise<void> {
  console.log('[BillingStateMachine] starting…')
  const startedAt = Date.now()

  const now = new Date()

  // Tenant has no deletedAt column (unlike User/Lead) — status filter
  // alone already excludes CANCELLED tenants we don't want to touch.
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ['TRIAL', 'PAYMENT_OVERDUE'] } },
    select: {
      id: true,
      name: true,
      tradeName: true,
      cnpj: true,
      document: true,
      status: true,
      trialEndsAt: true,
      planCycle: true,
      preferredPaymentMethod: true,
      addressStreet: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      addressNumber: true,
      addressNeighborhood: true,
      addressComplement: true,
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
  let errors = 0
  let chargesGenerated = 0
  let chargesSkipped = 0
  let chargesFailed = 0
  let overdueD0Sent = 0
  let overdueD7Sent = 0
  let suspendedD10Sent = 0
  let statusChangedToOverdue = 0
  let statusChangedToSuspended = 0

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

      if (diasRestantes < 0) {
        // Trial ended — tenant is either still flagged TRIAL (never
        // processed post-expiry) or already sitting in PAYMENT_OVERDUE.
        // Either way we fall into the OVERDUE lane. Evaluate markers
        // from most-advanced to least-advanced so a long-overdue tenant
        // never gets pinned at an earlier state.
        const daysOverdue = -diasRestantes
        if (tenant.lastBillingState === 'OVERDUE_D7_SENT' && daysOverdue >= 10) {
          targetState = 'SUSPENDED_D10_SENT'
          templateId = BILLING_TEMPLATES.SUSPENDED_D10
        } else if (tenant.lastBillingState === 'OVERDUE_D0_SENT' && daysOverdue >= 7) {
          targetState = 'OVERDUE_D7_SENT'
          templateId = BILLING_TEMPLATES.OVERDUE_D7
        } else if (
          !tenant.lastBillingState ||
          tenant.lastBillingState === 'TRIAL_EXPIRED'
        ) {
          // First visit post-expiry — or tenant carries the legacy
          // 'TRIAL_EXPIRED' marker from the pre-6E version of this job.
          targetState = 'OVERDUE_D0_SENT'
          templateId = BILLING_TEMPLATES.OVERDUE_D0
        }
        // Else: SUSPENDED_D10_SENT already fired — terminal for this job.
      } else if (diasRestantes <= 1) {
        if (!['TRIAL_D1_SENT', 'TRIAL_EXPIRED'].includes(tenant.lastBillingState ?? '')) {
          targetState = 'TRIAL_D1_SENT'
          templateId = BILLING_TEMPLATES.TRIAL_D1
        }
      } else if (diasRestantes <= 3) {
        if (!['TRIAL_D3_SENT', 'TRIAL_D1_SENT', 'TRIAL_EXPIRED'].includes(tenant.lastBillingState ?? '')) {
          targetState = 'TRIAL_D3_SENT'
          templateId = BILLING_TEMPLATES.TRIAL_D3
        }
      } else if (diasRestantes <= 7) {
        if (!['TRIAL_D7_SENT', 'TRIAL_D3_SENT', 'TRIAL_D1_SENT', 'TRIAL_EXPIRED'].includes(tenant.lastBillingState ?? '')) {
          targetState = 'TRIAL_D7_SENT'
          templateId = BILLING_TEMPLATES.TRIAL_D7
        }
      }

      if (!targetState) continue // Nothing to do this run.

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

      const params = buildParamsForState(targetState, tenant, owner)

      const result = await sendTemplateMail({
        to: owner.email,
        templateId: templateId!,
        params,
        tenantId: tenant.id,
      })

      if (!result.sent) {
        console.error(`[BillingStateMachine] failed to send email to tenant=${tenant.id} owner=${owner.email} reason=${result.reason} error=${result.error}`)
        errors++
        // Leave lastBillingState untouched so next run retries.
        continue
      }

      // When firing OVERDUE_D0_SENT to a still-TRIAL tenant, we also
      // flip status to PAYMENT_OVERDUE. When firing SUSPENDED_D10_SENT
      // to a PAYMENT_OVERDUE tenant, we flip to SUSPENDED. Any other
      // combination leaves the current status untouched.
      const willTransitionToOverdue =
        targetState === 'OVERDUE_D0_SENT' && tenant.status === 'TRIAL'
      const willTransitionToSuspended =
        targetState === 'SUSPENDED_D10_SENT' && tenant.status === 'PAYMENT_OVERDUE'
      let newStatus: 'TRIAL' | 'ACTIVE' | 'PAYMENT_OVERDUE' | 'SUSPENDED' | 'CANCELLED' = tenant.status
      if (willTransitionToOverdue) newStatus = 'PAYMENT_OVERDUE'
      else if (willTransitionToSuspended) newStatus = 'SUSPENDED'

      // updateMany with a composed `where` guards against a race with
      // the Efi webhook: if the user paid between our findMany and
      // this update, the tenant is already ACTIVE and we must not
      // regress it. count === 0 means the row no longer matches —
      // treat as a no-op. SUSPENDED is included so we can still stamp
      // lastBillingState even if the tenant was suspended by another
      // path between findMany and update.
      const updateResult = await prisma.tenant.updateMany({
        where: {
          id: tenant.id,
          status: { in: ['TRIAL', 'PAYMENT_OVERDUE', 'SUSPENDED'] },
        },
        data: {
          status: newStatus,
          lastBillingState: targetState,
          lastBillingStateAt: new Date(),
        },
      })

      if (updateResult.count === 0) {
        console.log(`[BillingStateMachine] tenant=${tenant.id} update skipped (status already ACTIVE, likely paid between findMany and update)`)
        continue
      }

      sent++
      if (targetState === 'OVERDUE_D0_SENT') overdueD0Sent++
      if (targetState === 'OVERDUE_D7_SENT') overdueD7Sent++
      if (targetState === 'SUSPENDED_D10_SENT') suspendedD10Sent++

      if (willTransitionToOverdue) {
        statusChangedToOverdue++
        console.log(`[BillingStateMachine] tenant=${tenant.id} transitioned TRIAL → PAYMENT_OVERDUE + D+0 email sent`)
      } else if (willTransitionToSuspended) {
        statusChangedToSuspended++
        console.log(`[BillingStateMachine] tenant=${tenant.id} transitioned PAYMENT_OVERDUE → SUSPENDED + D+10 email sent`)
      } else {
        console.log(`[BillingStateMachine] sent ${targetState} to tenant=${tenant.id} owner=${owner.email}`)
      }
    } catch (err: any) {
      console.error(`[BillingStateMachine] unexpected error on tenant ${tenant.id}: ${err?.message ?? err}`)
      errors++
    }
  }

  const duration = Date.now() - startedAt
  console.log(
    `[BillingStateMachine] done in ${duration}ms: ` +
    `processed=${processed} sent=${sent} ` +
    `skippedNoOwner=${skippedNoOwner} errors=${errors} ` +
    `chargesGenerated=${chargesGenerated} chargesSkipped=${chargesSkipped} chargesFailed=${chargesFailed} ` +
    `overdueD0=${overdueD0Sent} overdueD7=${overdueD7Sent} ` +
    `newOverdueTenants=${statusChangedToOverdue} ` +
    `suspendedD10=${suspendedD10Sent} ` +
    `newSuspendedTenants=${statusChangedToSuspended}`,
  )
}
