import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getAuthorizationUrl,
  getCalendarAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokens,
  getConnectionStatus,
} from '../services/googleOAuth.service'

const router = Router()
const GMAIL_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://tribocrm-production.up.railway.app/oauth/google/callback'
const CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://tribocrm-production.up.railway.app/oauth/calendar/callback'

// ── Gmail ──

router.get('/google/authorize', authMiddleware, (req: Request, res: Response) => {
  try {
    const url = getAuthorizationUrl(req.user!.userId, req.user!.tenantId)
    res.redirect(url)
  } catch (error: any) {
    console.error('[OAuth] gmail authorize error:', error)
    res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } })
  }
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query
  const frontendUrl = process.env.FRONTEND_URL || 'https://tribocrm.vercel.app'

  if (error || !code || !state) {
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=${error ? 'denied' : 'missing_params'}`)
    return
  }

  try {
    const result = await exchangeCodeForTokens(code as string, state as string, GMAIL_REDIRECT_URI)
    await saveTokens(result.userId, result.tenantId, result.provider, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 3600,
    })
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&connected=gmail`)
  } catch (err: any) {
    console.error('[OAuth] gmail callback error:', err)
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=token_exchange`)
  }
})

router.get('/google/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus(req.user!.userId, 'GMAIL')
    res.json({ success: true, data: status })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } })
  }
})

// ── Google Calendar ──

router.get('/calendar/authorize', authMiddleware, (req: Request, res: Response) => {
  try {
    const url = getCalendarAuthorizationUrl(req.user!.userId, req.user!.tenantId)
    res.redirect(url)
  } catch (error: any) {
    console.error('[OAuth] calendar authorize error:', error)
    res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } })
  }
})

router.get('/calendar/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query
  const frontendUrl = process.env.FRONTEND_URL || 'https://tribocrm.vercel.app'

  if (error || !code || !state) {
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=${error ? 'denied' : 'missing_params'}`)
    return
  }

  try {
    const result = await exchangeCodeForTokens(code as string, state as string, CALENDAR_REDIRECT_URI)
    await saveTokens(result.userId, result.tenantId, result.provider, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 3600,
    })
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&connected=calendar`)
  } catch (err: any) {
    console.error('[OAuth] calendar callback error:', err)
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=token_exchange`)
  }
})

router.get('/calendar/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus(req.user!.userId, 'GOOGLE_CALENDAR')
    res.json({ success: true, data: status })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } })
  }
})

export default router
