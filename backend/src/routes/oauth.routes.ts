import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokens,
  getConnectionStatus,
} from '../services/googleOAuth.service'

const router = Router()

// GET /oauth/google/authorize — requires auth, returns Google OAuth URL
router.get('/google/authorize', authMiddleware, (req: Request, res: Response) => {
  try {
    const url = getAuthorizationUrl(req.user!.userId, req.user!.tenantId)
    res.json({ success: true, data: { url } })
  } catch (error) {
    console.error('[OAuth] authorize error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar URL de autorização' } })
  }
})

// GET /oauth/google/callback — NO authMiddleware (called by Google redirect, not by frontend)
// userId and tenantId are extracted from the signed JWT in the "state" parameter
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query

  const frontendUrl = process.env.FRONTEND_URL || 'https://tribocrm.vercel.app'

  if (error) {
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=denied`)
    return
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=missing_params`)
    return
  }

  try {
    const result = await exchangeCodeForTokens(code as string, state as string)

    await saveTokens(result.userId, result.tenantId, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 3600,
    })

    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&connected=gmail`)
  } catch (err) {
    console.error('[OAuth] callback error:', err)
    res.redirect(`${frontendUrl}/gestao/configuracoes?tab=integracoes&error=token_exchange`)
  }
})

// GET /oauth/google/status — requires auth, returns connection status
router.get('/google/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus(req.user!.userId)
    res.json({ success: true, data: status })
  } catch (error) {
    console.error('[OAuth] status error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar status' } })
  }
})

export default router
