import { getValidToken } from './googleOAuth.service'

const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const TRACKING_BASE = 'https://tribocrm-production.up.railway.app/email/track'

function buildMimeMessage(to: string, subject: string, body: string, trackingPixelId?: string): string {
  let htmlBody = body.replace(/\n/g, '<br/>')

  if (trackingPixelId) {
    htmlBody += `<img src="${TRACKING_BASE}/${trackingPixelId}" width="1" height="1" style="display:none" />`
  }

  const boundary = `boundary_${Date.now()}`
  const mime = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n')

  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendEmail(
  userId: string,
  tenantId: string,
  to: string,
  subject: string,
  body: string,
  trackingPixelId?: string,
): Promise<{ messageId: string }> {
  const accessToken = await getValidToken(userId, tenantId)

  if (!accessToken) {
    throw new Error('Gmail not connected or token expired. Please reconnect your Gmail account.')
  }

  const raw = buildMimeMessage(to, subject, body, trackingPixelId)

  const res = await fetch(GMAIL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const error = await res.json() as { error?: { message?: string } }
    throw new Error(`Gmail API error: ${error.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as { id: string }

  return { messageId: data.id }
}
