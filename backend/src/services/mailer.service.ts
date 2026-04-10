import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Generic SMTP mailer.
 *
 * Reads SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM from env.
 * If any of the required fields is missing, every send call resolves with
 * { sent: false, reason: 'not_configured' } and logs a warning. The intent
 * is that nothing in the codebase ever throws because the SMTP isn't set —
 * the user-facing flow (e.g. createUser) succeeds either way and the
 * caller decides how to surface the email status to the UI.
 */

let transporter: Transporter | null = null
let cachedConfigured: boolean | null = null

export function isMailerConfigured(): boolean {
  if (cachedConfigured !== null) return cachedConfigured
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  cachedConfigured = !!(host && user && pass)
  return cachedConfigured
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter
  if (!isMailerConfigured()) return null

  const host = process.env.SMTP_HOST!
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const user = process.env.SMTP_USER!
  const pass = process.env.SMTP_PASS!
  const secure = process.env.SMTP_SECURE === 'true'

  // secure=true for port 465 (implicit TLS), false for 587 (STARTTLS)
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })
  return transporter
}

export interface SendMailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export interface SendMailResult {
  sent: boolean
  reason?: 'not_configured' | 'send_error'
  messageId?: string
  error?: string
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  const t = getTransporter()
  if (!t) {
    console.warn(`[Mailer] not configured, skipping email to ${opts.to} (subject: ${opts.subject.slice(0, 60)})`)
    return { sent: false, reason: 'not_configured' }
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!

  try {
    const info = await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    })
    return { sent: true, messageId: info.messageId }
  } catch (err: any) {
    console.error('[Mailer] sendMail failed:', err?.message ?? err)
    return { sent: false, reason: 'send_error', error: err?.message ?? String(err) }
  }
}
