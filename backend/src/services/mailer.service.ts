/**
 * Brevo (ex-Sendinblue) HTTP API mailer.
 *
 * Uses POST https://api.brevo.com/v3/smtp/email with BREVO_API_KEY.
 * If the key is missing, every send call resolves with
 * { sent: false, reason: 'not_configured' } and logs a warning.
 * Nothing in the codebase ever throws because the mailer isn't set —
 * the caller decides how to surface the email status to the UI.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export function isMailerConfigured(): boolean {
  return !!process.env.BREVO_API_KEY
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
  if (!isMailerConfigured()) {
    console.warn(`[Mailer] BREVO_API_KEY not configured, skipping email to ${opts.to} (subject: ${opts.subject.slice(0, 60)})`)
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
      return { sent: false, reason: 'send_error', error: `Brevo ${res.status}: ${errBody}` }
    }

    const data = await res.json() as { messageId?: string }
    return { sent: true, messageId: data.messageId }
  } catch (err: any) {
    console.error('[Mailer] sendMail failed:', err?.message ?? err)
    return { sent: false, reason: 'send_error', error: err?.message ?? String(err) }
  }
}
