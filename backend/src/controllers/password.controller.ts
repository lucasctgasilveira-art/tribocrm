import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma'
import { sendMail } from '../services/mailer.service'

const BCRYPT_ROUNDS = 12
const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /public/forgot-password { email }
//
// Always resolves with HTTP 200 and the same generic message — we
// never leak whether an email is registered. If a user row matches,
// we stamp passwordResetToken + passwordResetExpiresAt (now+1h) and
// fire the reset-link email. If it doesn't match, we silently skip.
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const genericOk = () => res.json({
    success: true,
    data: { message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' },
  })

  try {
    const email = String((req.body ?? {}).email ?? '').trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      // Still generic — no revelation.
      genericOk()
      return
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    })

    if (!user) {
      console.info('[Password] forgot-password requested for unknown email (silent ok)')
      genericOk()
      return
    }

    const token = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + RESET_TTL_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    })

    const resetUrl = `${process.env.FRONTEND_URL || 'https://app.tribocrm.com.br'}/auth/reset-password?token=${token}`
    const firstName = (user.name || '').trim().split(' ')[0] || 'Olá'
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#111318;color:#f3f4f6;padding:32px;border-radius:12px;max-width:520px;margin:0 auto">
        <div style="font-size:20px;font-weight:700;color:#f97316;margin-bottom:8px">TriboCRM</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">Redefinir senha</div>
        <p style="font-size:14px;line-height:1.5;color:#d1d5db;margin:0 0 20px">
          ${firstName}, recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Redefinir minha senha</a>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">Se você não solicitou essa alteração, pode ignorar este e-mail com segurança — sua senha atual continuará válida.</p>
        <p style="font-size:11px;color:#6b7280;margin-top:16px;word-break:break-all">Link manual: ${resetUrl}</p>
      </div>`

    console.info('[Password] sending reset email to:', email)
    try {
      const mailResult = await sendMail({
        to: email,
        subject: 'Redefinir sua senha — TriboCRM',
        text: `Recebemos um pedido para redefinir sua senha no TriboCRM. Acesse: ${resetUrl} (link válido por 1 hora).`,
        html,
      })
      console.info('[Password] reset email result:', JSON.stringify(mailResult))
    } catch (mailErr: any) {
      console.error('[Password] reset email send error:', mailErr?.message ?? mailErr)
    }

    genericOk()
  } catch (error: any) {
    const safeBody = (() => { try { return JSON.stringify(req.body).substring(0, 300) } catch { return '[unserializable]' } })()
    console.error('[Password] forgotPassword error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      body: safeBody,
    })
    // Still generic so an attacker can't infer DB issues either.
    res.json({
      success: true,
      data: { message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' },
    })
  }
}

// POST /public/reset-password { token, password }
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const token = String((req.body ?? {}).token ?? '').trim()
    const password = String((req.body ?? {}).password ?? '')

    if (!token) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Token é obrigatório' },
      })
      return
    }
    if (!password || password.length < 8) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A senha deve ter no mínimo 8 caracteres' },
      })
      return
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Link inválido ou expirado. Solicite um novo link.' },
      })
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    })

    res.json({ success: true, data: { message: 'Senha alterada com sucesso' } })
  } catch (error: any) {
    const safeBody = (() => {
      try {
        const raw = { ...(req.body ?? {}) } as Record<string, unknown>
        if ('password' in raw) raw.password = '[redacted]'
        return JSON.stringify(raw).substring(0, 300)
      } catch { return '[unserializable]' }
    })()
    console.error('[Password] resetPassword error:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      body: safeBody,
    })
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao redefinir senha' },
    })
  }
}
