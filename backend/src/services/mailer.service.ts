/**
 * Brevo (ex-Sendinblue) HTTP API mailer.
 *
 * Uses POST https://api.brevo.com/v3/smtp/email with BREVO_API_KEY.
 * If the key is missing, every send call resolves with
 * { sent: false, reason: 'not_configured' } and logs a warning.
 * Nothing in the codebase ever throws because the mailer isn't set —
 * the caller decides how to surface the email status to the UI.
 *
 * Sub-etapa 6L.1.a: every attempt (sent / failed / skipped) is also
 * persisted to email_logs via fire-and-forget logEmailAttempt() so
 * the super-admin UI can surface delivery state. Failure to write the
 * log row is swallowed — the email itself is the source of truth.
 */

import { prisma } from '../lib/prisma'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

interface EmailLogEntry {
  tenantId?: string | null
  toEmail: string
  templateId?: number | null
  subject?: string | null
  status: 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED'
  brevoMessageId?: string | null
  errorReason?: string | null
  errorDetails?: string | null
  paramsJson?: Record<string, unknown> | null
}

async function logEmailAttempt(entry: EmailLogEntry): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        tenantId: entry.tenantId ?? null,
        toEmail: entry.toEmail,
        templateId: entry.templateId ?? null,
        subject: entry.subject ?? null,
        status: entry.status,
        brevoMessageId: entry.brevoMessageId ?? null,
        errorReason: entry.errorReason ?? null,
        errorDetails: entry.errorDetails ?? null,
        paramsJson: (entry.paramsJson as any) ?? undefined,
      },
    })
  } catch (err: any) {
    // Fire-and-forget: failing to log NEVER blocks the email itself.
    console.error(`[Mailer:logEmailAttempt] failed to persist log: ${err?.message ?? err}`)
  }
}

export function isMailerConfigured(): boolean {
  return !!process.env.BREVO_API_KEY
}

export interface SendMailOptions {
  to: string
  subject: string
  text: string
  html?: string
  tenantId?: string | null
}

export interface SendMailResult {
  sent: boolean
  reason?: 'not_configured' | 'send_error'
  messageId?: string
  error?: string
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  if (!isMailerConfigured()) {
    console.warn(`[Mailer] BREVO_API_KEY not configured, skipping email to ${opts.to} (subject: ${opts.subject.slice(0, 60)})`)
    await logEmailAttempt({
      tenantId: opts.tenantId,
      toEmail: opts.to,
      subject: opts.subject,
      status: 'SKIPPED_NOT_CONFIGURED',
      errorReason: 'not_configured',
    })
    return { sent: false, reason: 'not_configured' }
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@tribodevendas.com.br'

  const body = {
    sender: { name: 'TriboCRM', email: fromEmail },
    to: [{ email: opts.to }],
    subject: opts.subject,
    htmlContent: opts.html || `<p>${opts.text}</p>`,
    textContent: opts.text,
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[Mailer] Brevo API error ${res.status}:`, errBody)
      await logEmailAttempt({
        tenantId: opts.tenantId,
        toEmail: opts.to,
        subject: opts.subject,
        status: 'FAILED',
        errorReason: 'http_error',
        errorDetails: `Brevo ${res.status}: ${errBody}`,
      })
      return { sent: false, reason: 'send_error', error: `Brevo ${res.status}: ${errBody}` }
    }

    const data = await res.json() as { messageId?: string }
    await logEmailAttempt({
      tenantId: opts.tenantId,
      toEmail: opts.to,
      subject: opts.subject,
      status: 'SENT',
      brevoMessageId: data.messageId ?? null,
    })
    return { sent: true, messageId: data.messageId }
  } catch (err: any) {
    console.error('[Mailer] sendMail failed:', err?.message ?? err)
    await logEmailAttempt({
      tenantId: opts.tenantId,
      toEmail: opts.to,
      subject: opts.subject,
      status: 'FAILED',
      errorReason: 'send_error',
      errorDetails: err?.message ?? String(err),
    })
    return { sent: false, reason: 'send_error', error: err?.message ?? String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Transactional templates (billing flow)
//
// Uses the same Brevo endpoint but triggers server-side templates by
// ID rather than sending inline HTML. Template copy / layout lives in
// the Brevo dashboard (app.brevo.com/templates) and variables are
// injected via the `params` object: e.g. `{{ params.firstName }}` in
// the template is filled from `params.firstName` here.
//
// Never throws — matches sendMail's policy so callers can await without
// a try/catch.
// ─────────────────────────────────────────────────────────────────────

export interface SendTemplateMailArgs {
  to: string
  templateId: number
  params: Record<string, string | number>
  replyTo?: string
  tenantId?: string | null
}

export interface SendTemplateMailResult {
  sent: boolean
  messageId?: string
  reason?: 'not_configured' | 'send_error'
  error?: string
}

export async function sendTemplateMail(args: SendTemplateMailArgs): Promise<SendTemplateMailResult> {
  if (!isMailerConfigured()) {
    console.warn(`[Mailer:template] BREVO_API_KEY not configured, skipping templateId=${args.templateId} to=${args.to}`)
    await logEmailAttempt({
      tenantId: args.tenantId,
      toEmail: args.to,
      templateId: args.templateId,
      status: 'SKIPPED_NOT_CONFIGURED',
      errorReason: 'not_configured',
      paramsJson: args.params,
    })
    return { sent: false, reason: 'not_configured' }
  }

  // TODO(6L): extract buildSender() helper once EmailRule table lands —
  // for now we duplicate the fallback line to keep sendMail() untouched.
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@tribodevendas.com.br'

  const body: Record<string, unknown> = {
    sender: { name: 'Lucas Silveira | TriboCRM', email: fromEmail },
    to: [{ email: args.to }],
    templateId: args.templateId,
    params: args.params,
  }
  if (args.replyTo) {
    body.replyTo = { email: args.replyTo }
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[Mailer:template] failed templateId=${args.templateId} to=${args.to} status=${res.status} body=${errBody}`)
      await logEmailAttempt({
        tenantId: args.tenantId,
        toEmail: args.to,
        templateId: args.templateId,
        status: 'FAILED',
        errorReason: 'http_error',
        errorDetails: `Brevo ${res.status}: ${errBody}`,
        paramsJson: args.params,
      })
      return { sent: false, reason: 'send_error', error: `Brevo ${res.status}: ${errBody}` }
    }

    const data = await res.json() as { messageId?: string }
    console.log(`[Mailer:template] sent templateId=${args.templateId} to=${args.to} messageId=${data.messageId ?? 'n/a'}`)
    await logEmailAttempt({
      tenantId: args.tenantId,
      toEmail: args.to,
      templateId: args.templateId,
      status: 'SENT',
      brevoMessageId: data.messageId ?? null,
      paramsJson: args.params,
    })
    return { sent: true, messageId: data.messageId }
  } catch (err: any) {
    console.error(`[Mailer:template] failed templateId=${args.templateId} to=${args.to} reason=${err?.message ?? err}`)
    await logEmailAttempt({
      tenantId: args.tenantId,
      toEmail: args.to,
      templateId: args.templateId,
      status: 'FAILED',
      errorReason: 'send_error',
      errorDetails: err?.message ?? String(err),
      paramsJson: args.params,
    })
    return { sent: false, reason: 'send_error', error: err?.message ?? String(err) }
  }
}
