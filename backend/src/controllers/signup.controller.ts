import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
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
    const { name, email, password, phone, companyName, planId } = (req.body ?? {}) as Record<string, unknown>

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
          planCycle: 'MONTHLY',
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
    sendMail({
      to: emailNorm,
      subject: 'Confirme seu e-mail — TriboCRM',
      text: `Olá! Confirme seu cadastro no TriboCRM acessando: ${verifyUrl}`,
      html,
    }).catch((e) => console.error('[Signup] verification email send error:', e?.message ?? e))

    res.status(201).json({
      success: true,
      data: {
        tenantId: created.tenantId,
        userId: created.userId,
        message: 'Conta criada! Verifique seu e-mail para ativar o acesso.',
      },
    })
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
      select: { id: true, emailVerified: true },
    })

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token inválido ou já utilizado' },
      })
      return
    }

    // Already-verified short-circuit: still return success so the UI
    // treats a reclicked link gracefully.
    if (user.emailVerified) {
      res.json({ success: true, data: { message: 'E-mail já confirmado' } })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    })

    res.json({ success: true, data: { message: 'E-mail confirmado com sucesso' } })
  } catch (error: any) {
    console.error('[Signup] verifyEmail error:', error?.message ?? error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar e-mail' },
    })
  }
}
