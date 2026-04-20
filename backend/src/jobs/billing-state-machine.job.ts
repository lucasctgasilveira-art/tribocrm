import { prisma } from '../lib/prisma'
import { sendTemplateMail } from '../services/mailer.service'
import { BILLING_TEMPLATES } from '../config/billing-templates'

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
      trialEndsAt: true,
      planCycle: true,
      preferredPaymentMethod: true,
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
    `skippedNoOwner=${skippedNoOwner} errors=${errors}`,
  )
}
