import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import type { OAuthProvider } from '@prisma/client'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email']
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/userinfo.email']

const GMAIL_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://tribocrm-production.up.railway.app/oauth/google/callback'
const CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://tribocrm-production.up.railway.app/oauth/calendar/callback'

const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? ''
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const [ivHex, encHex] = text.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid encrypted data')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ── Authorization URLs ──

export function getAuthorizationUrl(userId: string, tenantId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')

  const state = jwt.sign({ userId, tenantId, provider: 'GMAIL' }, process.env.JWT_SECRET!, { expiresIn: '10m' })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export function getCalendarAuthorizationUrl(userId: string, tenantId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')

  const state = jwt.sign({ userId, tenantId, provider: 'GOOGLE_CALENDAR' }, process.env.JWT_SECRET!, { expiresIn: '10m' })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CALENDAR_REDIRECT_URI,
    response_type: 'code',
    scope: CALENDAR_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// ── Token Exchange ──

export async function exchangeCodeForTokens(code: string, state: string, redirectUri: string): Promise<{ userId: string; tenantId: string; provider: OAuthProvider; accessToken: string; refreshToken: string; expiresIn: number; email: string }> {
  const decoded = jwt.verify(state, process.env.JWT_SECRET!) as { userId: string; tenantId: string; provider: OAuthProvider }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number; error?: string }

  if (tokenData.error) {
    throw new Error(`Google token error: ${tokenData.error}`)
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userInfo = await userInfoRes.json() as { email: string }

  return {
    userId: decoded.userId,
    tenantId: decoded.tenantId,
    provider: decoded.provider,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresIn: tokenData.expires_in,
    email: userInfo.email,
  }
}

// ── Token Refresh ──

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json() as { access_token: string; expires_in: number; error?: string }

  if (data.error) {
    throw new Error(`Google refresh error: ${data.error}`)
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

// ── Token Storage ──

export async function saveTokens(userId: string, tenantId: string, provider: OAuthProvider, tokens: { accessToken: string; refreshToken: string; expiresIn: number }): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000)

  await prisma.oAuthToken.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      tenantId,
      userId,
      provider,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      expiresAt,
    },
    update: {
      accessToken: encrypt(tokens.accessToken),
      ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
      expiresAt,
    },
  })
}

// ── Get Valid Token ──

export async function getValidToken(userId: string, tenantId: string, provider: OAuthProvider = 'GMAIL'): Promise<string | null> {
  const record = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider } },
  })

  if (!record) return null

  const now = new Date()
  const buffer = 5 * 60 * 1000

  if (record.expiresAt && record.expiresAt.getTime() - buffer > now.getTime()) {
    return decrypt(record.accessToken)
  }

  if (!record.refreshToken) return null

  try {
    const decryptedRefresh = decrypt(record.refreshToken)
    const { accessToken, expiresIn } = await refreshAccessToken(decryptedRefresh)
    await saveTokens(userId, tenantId, provider, { accessToken, refreshToken: '', expiresIn })
    return accessToken
  } catch (err) {
    console.error(`[GoogleOAuth] Failed to refresh ${provider} token:`, err)
    return null
  }
}

// ── Connection Status ──

export async function getConnectionStatus(userId: string, provider: OAuthProvider = 'GMAIL'): Promise<{ connected: boolean; email: string | null }> {
  const record = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider } },
  })

  if (!record) return { connected: false, email: null }

  try {
    const accessToken = decrypt(record.accessToken)
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const info = await res.json() as { email: string }
      return { connected: true, email: info.email }
    }
  } catch { /* ignore */ }

  return { connected: true, email: null }
}
