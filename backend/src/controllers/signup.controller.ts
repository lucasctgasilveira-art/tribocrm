import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma'
import { sendMail } from '../services/mailer.service'

const BCRYPT_ROUNDS = 12
const TRIAL_DAYS = 30

// Maps the PLAN_ID values the spec accepts (uppercase tokens)
// to the corresponding slug stored in the plans table. Accepts the
// lowercase variant and raw slug as well so clients with either
// convention keep working.
const PLAN_SLUG_BY_TOKEN: Record<string, string> = {
  SOLO: 'solo',
  ESSENCIAL: 'essencial',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
  solo: 'solo',
  essencial: 'essencial',
  pro: 'pro',
  enterprise: 'enterprise',
}

// 7 default pipeline stages as specified. WON (Venda Realizada) and
// LOST (Perdido) are marked isFixed so the gestor can't delete them
// — matches the invariant used across leads.controller and the
// wonCardsArchiver job.
const DEFAULT_STAGES: { name: string; color: string; type: 'NORMAL' | 'WON' | 'LOST' | 'REACTIVATION'; isFixed: boolean }[] = [
  { name: 'Sem Contato', color: '#6b7280', type: 'NORMAL', isFixed: false },
  { name: 'Em Contato', color: '#3b82f6', type: 'NORMAL', isFixed: false },
  { name: 'Negociando', color: '#f59e0b', type: 'NORMAL', isFixed: false },
  { name: 'Proposta Enviada', color: '#8b5cf6', type: 'NORMAL', isFixed: false },
  { name: 'Venda Realizada', color: '#22c55e', type: 'WON', isFixed: true },
  { name: 'Repescagem', color: '#f97316', type: 'REACTIVATION', isFixed: false },
  { name: 'Perdido', color: '#ef4444', type: 'LOST', isFixed: true },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function publicSignup(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, phone, companyName, planId, planCycle: rawPlanCycle } = (req.body ?? {}) as Record<string, unknown>

    // Required-field validation (mirrors the shape the signup screen
    // will POST). We don't use zod here to keep the file self-contained.
    const errs: string[] = []
    if (typeof name !== 'string' || !name.trim()) errs.push('name é obrigatório')
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) errs.push('email inválido')
    if (typeof password !== 'string' || password.length < 8) errs.push('password deve ter no mínimo 8 caracteres')
    if (typeof phone !== 'string' || !phone.trim()) errs.push('phone é obrigatório')
    if (typeof companyName !== 'string' || !companyName.trim()) errs.push('companyName é obrigatório')
    if (typeof planId !== 'string' || !planId.trim()) errs.push('planId é obrigatório')

    if (errs.length > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errs.join('; ') },
      })
      return
    }

    const emailNorm = (email as string).trim().toLowerCase()
    const planToken = (planId as string).trim()
    const planSlug = PLAN_SLUG_BY_TOKEN[planToken]
    // Cycle is optional; default MONTHLY. Anything other than 'YEARLY'
    // (case-sensitive — Prisma enum) collapses to MONTHLY so a malformed
    // body never ends up persisting an invalid enum value.
    const planCycle: 'MONTHLY' | 'YEARLY' = rawPlanCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'

    if (!planSlug) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'planId inválido — use SOLO, ESSENCIAL, PRO ou ENTERPRISE' },
      })
      return
    }

    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
    if (!plan) {
      res.status(400).json({
        success: false,
        error: { code: 'PLAN_NOT_FOUND', message: 'Plano não encontrado' },
      })
      return
    }

    // Global duplicate-email check. The unique constraint on users is
    // (tenantId, email) because a person may legitimately work for
    // multiple tenants as different invited users. For public signup,
    // however, we scope by email alone — a new tenant owner can't
    // claim an email already in use.
    const existing = await prisma.user.findFirst({
      where: { email: emailNorm, deletedAt: null },
      select: { id: true },
    })
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_IN_USE', message: 'Este e-mail já está em uso' },
      })
      return
    }

    const passwordHash = await bcrypt.hash(password as string, BCRYPT_ROUNDS)
    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    const verificationToken = randomUUID().replace(/-/g, '')

    // CNPJ column is NOT NULL + UNIQUE on tenants and typed VARCHAR(18).
    // Public signup doesn't collect a real CNPJ yet — we synthesize a
    // placeholder the gestor fills in later via PATCH /tenants. Budget
    // is tight: 1 char prefix + 17 hex from a fresh UUID fits exactly
    // in 18 chars (2^68 combinations → collisions are astronomically
    // improbable). Previous version used `PENDING-<12hex>` = 20 chars
    // and overflowed the column on every signup — do not grow the
    // prefix back without also widening the column.
    const placeholderCnpj = `P${randomUUID().replace(/-/g, '').slice(0, 17)}`
    console.info('[Signup] creating tenant placeholderCnpj=%s length=%d', placeholderCnpj, placeholderCnpj.length)

    const created = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: (companyName as string).trim(),
          cnpj: placeholderCnpj,
          email: emailNorm,
          phone: (phone as string).trim(),
          planId: plan.id,
          planCycle,
          status: 'TRIAL',
          trialEndsAt,
          planStartedAt: now,
        },
        select: { id: true },
      })

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: (name as string).trim(),
          email: emailNorm,
          passwordHash,
          role: 'OWNER',
          phone: (phone as string).trim(),
          isActive: true,
          emailVerified: false,
          emailVerificationToken: verificationToken,
        },
        select: { id: true },
      })

      const pipeline = await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: 'Pipeline Principal',
          isDefault: true,
          distributionType: 'MANUAL',
          isActive: true,
        },
        select: { id: true },
      })

      await tx.pipelineStage.createMany({
        data: DEFAULT_STAGES.map((s, idx) => ({
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          name: s.name,
          color: s.color,
          type: s.type,
          sortOrder: idx,
          isFixed: s.isFixed,
        })),
      })

      return { tenantId: tenant.id, userId: user.id }
    })

    // Confirmation email — fire-and-await so we can at least log the
    // mailer status, but a failed send does NOT roll back the signup:
    // the user can request a resend later. The gestor sees the verify
    // screen immediately after signup regardless.
    const verifyUrl = `${process.env.FRONTEND_URL || 'https://app.tribocrm.com.br'}/auth/verify-email?token=${verificationToken}`
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#111318;color:#f3f4f6;padding:32px;border-radius:12px;max-width:520px;margin:0 auto">
        <div style="font-size:20px;font-weight:700;color:#f97316;margin-bottom:8px">TriboCRM</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">Confirme seu e-mail</div>
        <p style="font-size:14px;line-height:1.5;color:#d1d5db;margin:0 0 20px">
          Olá, ${(name as string).trim().split(' ')[0]}! Clique no botão abaixo para ativar seu acesso ao TriboCRM.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Confirmar e-mail</a>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">Se o botão não funcionar, copie este link: <br/><span style="color:#f97316;word-break:break-all">${verifyUrl}</span></p>
      </div>`
    // Awaited so the log captures the actual Brevo status for this
    // request. Wrapped in try/catch so a mailer failure never turns
    // a successful signup into a 500 — the user's row is already
    // committed; they just won't get the email until a resend.
    console.info('[Signup] sending verification email to:', emailNorm)
    try {
      const mailResult = await sendMail({
        to: emailNorm,
        subject: 'Confirme seu e-mail — TriboCRM',
        text: `Olá! Confirme seu cadastro no TriboCRM acessando: ${verifyUrl}`,
        html,
      })
      console.info('[Signup] email result:', JSON.stringify(mailResult))
    } catch (mailErr: any) {
      console.error('[Signup] verification email send error:', mailErr?.message ?? mailErr)
    }

    res.status(201).json({
      success: true,
      data: {
        tenantId: created.tenantId,
        userId: created.userId,
        message: 'Conta criada! Verifique seu e-mail para ativar o acesso.',
      },
    })

    // Post-response: try to move the platform-tenant's lead (if the
    // email already sits there from a capture form) to the "Pós-venda"
    // pipeline. Runs after res.json so a slow lookup never delays the
    // signup confirmation. Wrapped in its own try/catch so any failure
    // here is purely informational — the gestor's account is already
    // committed regardless.
    movePlatformLeadToPosVenda({
      email: emailNorm,
      planSlug,
    }).catch((e) => console.error('[Signup] post-signup lead move failed:', e?.message ?? e))
  } catch (error: any) {
    // Verbose log so the next failure is diagnosable from Railway
    // alone: Prisma errors carry `code` (e.g. P2002 for unique
    // violation) and `meta` (e.g. { target: ['cnpj'] }) that the
    // naked `.message` string hides.
    const safeBody = (() => {
      try { return JSON.stringify(req.body).substring(0, 500) } catch { return '[unserializable]' }
    })()
    console.error('[Signup] publicSignup error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      body: safeBody,
    })
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar conta' },
    })
  }
}

// ─────────────────────────────────────────────────────────────────────
// Post-signup lead handoff.
//
// When a visitor fills the landing-page capture form, a Lead row is
// created inside the *Tribo de Vendas* tenant (the platform owner).
// When that same person later finishes signup and becomes a real
// tenant, we shuttle their lead into the platform's "Pós-venda"
// pipeline so the commercial team stops treating them as a prospect.
//
// Identification of the platform tenant (in priority order):
//   1. process.env.PLATFORM_TENANT_ID (explicit override)
//   2. A SUPER_ADMIN's linkedTenantId (set via dual-access flow)
//   3. The tenant created by the seed (cnpj '00.000.000/0001-00')
//
// All three are best-effort — if none resolves we silently exit. The
// caller already wraps this in a `.catch()` so any throw is logged
// but never impacts the signup response.
// ─────────────────────────────────────────────────────────────────────
async function movePlatformLeadToPosVenda(args: { email: string; planSlug: string }): Promise<void> {
  const { email, planSlug } = args

  // 1. Resolve the platform tenant.
  let platformTenantId: string | null = null

  if (process.env.PLATFORM_TENANT_ID) {
    platformTenantId = process.env.PLATFORM_TENANT_ID
  }

  if (!platformTenantId) {
    const admin = await prisma.adminUser.findFirst({
      where: { role: 'SUPER_ADMIN', linkedTenantId: { not: null } },
      select: { linkedTenantId: true },
    }).catch(() => null)
    if (admin?.linkedTenantId) platformTenantId = admin.linkedTenantId
  }

  if (!platformTenantId) {
    // Fallback to the seed tenant (Tribo de Vendas, cnpj 00.000.000/0001-00).
    const seedTenant = await prisma.tenant.findUnique({
      where: { cnpj: '00.000.000/0001-00' },
      select: { id: true },
    }).catch(() => null)
    if (seedTenant?.id) platformTenantId = seedTenant.id
  }

  if (!platformTenantId) {
    console.info('[Signup] post-signup lead move skipped — platform tenant not resolved')
    return
  }

  // 2. Find the lead on the platform tenant by email. Case-insensitive
  // match so a lead captured as "João@X.com" still resolves for a
  // signup email normalised to lowercase.
  const lead = await prisma.lead.findFirst({
    where: {
      tenantId: platformTenantId,
      email: { equals: email, mode: 'insensitive' },
      deletedAt: null,
    },
    select: { id: true, responsibleId: true, stageId: true },
  })

  if (!lead) {
    console.info('[Signup] post-signup lead move skipped — no lead on platform tenant for', email)
    return
  }

  // 3. Find the Pós-venda pipeline on the platform tenant. Case- and
  // accent-tolerant: matches "Pós-venda", "Pos-venda", "POS-VENDA"...
  const pipelines = await prisma.pipeline.findMany({
    where: { tenantId: platformTenantId, isActive: true },
    include: { stages: { orderBy: { sortOrder: 'asc' } } },
  })

  const posVenda = pipelines.find(p => {
    const n = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return n === 'pos-venda' || n === 'pos venda' || n === 'posvenda'
  })

  if (!posVenda) {
    console.info('[Signup] post-signup lead move skipped — Pós-venda pipeline not found')
    return
  }

  // 4. Pick the first non-fixed, non-terminal stage (lowest sortOrder
  // that isn't WON/LOST). Falls back to the very first stage if every
  // stage is terminal — unusual but keeps the move from failing.
  const firstStage =
    posVenda.stages.find(s => !s.isFixed && s.type !== 'WON' && s.type !== 'LOST') ??
    posVenda.stages[0]

  if (!firstStage) {
    console.info('[Signup] post-signup lead move skipped — Pós-venda has no stages')
    return
  }

  if (lead.stageId === firstStage.id) {
    console.info('[Signup] post-signup lead already on Pós-venda first stage, skipping move')
    return
  }

  // 5. Move the lead + append the system interaction. `userId` is
  // required by the Interaction FK — reuse the lead's current
  // responsible and mark isAuto=true so the drawer renders "Sistema".
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        pipelineId: posVenda.id,
        stageId: firstStage.id,
        lastActivityAt: new Date(),
      },
    }),
    prisma.interaction.create({
      data: {
        tenantId: platformTenantId,
        leadId: lead.id,
        userId: lead.responsibleId,
        type: 'SYSTEM',
        content: `Cliente finalizou o cadastro no TriboCRM — Plano ${planSlug.toUpperCase()}`,
        isAuto: true,
      },
    }),
  ])

  console.info('[Signup] moved platform lead', lead.id, 'to Pós-venda stage', firstStage.id)
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.query.token ?? '').trim()
    if (!token) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Token é obrigatório' },
      })
      return
    }

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token, deletedAt: null },
      select: { id: true, tenantId: true, role: true, emailVerified: true, name: true, email: true },
    })

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token inválido ou já utilizado' },
      })
      return
    }

    // Already-verified short-circuit. Still issues tokens so a
    // reclicked link can land the user in the auto-login page.
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerificationToken: null },
      })
    }

    // Generate a session so the user can land on the checkout (or any
    // protected page) immediately without typing their password again.
    // Same structure as auth.controller's generateAccessToken /
    // generateRefreshToken — reproduced here because those functions
    // are module-private in auth.controller.
    const jwtSecret = process.env.JWT_SECRET
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET
    let accessToken: string | null = null
    let refreshToken: string | null = null

    if (jwtSecret && jwtRefreshSecret) {
      const payload = { userId: user.id, tenantId: user.tenantId, role: user.role }
      accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '8h' })
      refreshToken = jwt.sign(payload, jwtRefreshSecret, { expiresIn: '30d' })
    }

    // Derive plano + ciclo from the tenant's current state so the
    // frontend can deep-link to /checkout with the right params
    // without reading localStorage (which may be on another device).
    let plano = 'essencial'
    let ciclo = 'mensal'
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { plan: { select: { slug: true } } },
      })
      if (tenant) {
        plano = tenant.plan.slug ?? 'essencial'
        ciclo = tenant.planCycle === 'YEARLY' ? 'anual' : 'mensal'
      }
    } catch { /* keep defaults */ }

    res.json({
      success: true,
      data: {
        message: 'E-mail confirmado com sucesso',
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
        plano,
        ciclo,
      },
    })
  } catch (error: any) {
    console.error('[Signup] verifyEmail error:', error?.message ?? error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar e-mail' },
    })
  }
}

// POST /public/resend-verification { email }
//
// Issues a fresh emailVerificationToken for an unverified user and
// re-sends the confirmation email. Same privacy stance as
// forgot-password: we never reveal whether the email is registered
// or already verified — every branch resolves with the same generic
// message. A malformed email still returns 200 (cheap DoS protection:
// attackers can't use this to probe the user table).
export async function resendVerification(req: Request, res: Response): Promise<void> {
  const genericOk = () => res.json({
    success: true,
    message: 'Se este e-mail estiver pendente de verificação, você receberá um novo link.',
  })

  try {
    const email = String((req.body ?? {}).email ?? '').trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      genericOk()
      return
    }

    const user = await prisma.user.findFirst({
      where: { email, emailVerified: false, deletedAt: null },
      select: { id: true, name: true },
    })

    if (!user) {
      console.info('[Signup] resend-verification requested for unknown or already-verified email (silent ok)')
      genericOk()
      return
    }

    const verificationToken = randomUUID().replace(/-/g, '')
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: verificationToken },
    })

    const verifyUrl = `${process.env.FRONTEND_URL || 'https://app.tribocrm.com.br'}/auth/verify-email?token=${verificationToken}`
    const firstName = (user.name || '').trim().split(' ')[0] || 'Olá'
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#111318;color:#f3f4f6;padding:32px;border-radius:12px;max-width:520px;margin:0 auto">
        <div style="font-size:20px;font-weight:700;color:#f97316;margin-bottom:8px">TriboCRM</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">Confirme seu e-mail</div>
        <p style="font-size:14px;line-height:1.5;color:#d1d5db;margin:0 0 20px">
          ${firstName}, clique no botão abaixo para ativar seu acesso ao TriboCRM.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Confirmar e-mail</a>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">Se o botão não funcionar, copie este link: <br/><span style="color:#f97316;word-break:break-all">${verifyUrl}</span></p>
      </div>`

    console.info('[Signup] resending verification email to:', email)
    try {
      const mailResult = await sendMail({
        to: email,
        subject: 'Confirme seu e-mail — TriboCRM',
        text: `Confirme seu cadastro no TriboCRM: ${verifyUrl}`,
        html,
      })
      console.info('[Signup] resend email result:', JSON.stringify(mailResult))
    } catch (mailErr: any) {
      console.error('[Signup] resend email send error:', mailErr?.message ?? mailErr)
    }

    genericOk()
  } catch (error: any) {
    const safeBody = (() => { try { return JSON.stringify(req.body).substring(0, 300) } catch { return '[unserializable]' } })()
    console.error('[Signup] resendVerification error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      body: safeBody,
    })
    // Same generic response on error so attackers can't infer DB issues.
    res.json({
      success: true,
      message: 'Se este e-mail estiver pendente de verificação, você receberá um novo link.',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────
// Manual fixes for test users stuck with email_verified=false. Do NOT
// run automatically — paste into the Supabase SQL editor, replacing
// the email list with the real addresses you want to unblock:
//
//   UPDATE users
//     SET email_verified = true,
//         email_verification_token = NULL
//     WHERE email IN ('lucas@tribodevendas.com.br', 'outro@teste.com');
//
// If the user already clicked a stale verification link and hit 404
// because the token was rotated by another signup attempt, running the
// above flips their row so login succeeds without needing to re-send.
// ─────────────────────────────────────────────────────────────────────
