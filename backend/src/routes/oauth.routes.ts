import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getAuthorizationUrl,
  getConnectionStatus,
} from '../services/googleOAuth.service'

const router = Router()

// Teste sem auth
router.get('/debug', (req: Request, res: Response) => {
  res.json({ ok: true, query: req.query, headers: req.headers.authorization || 'none' })
})

// Authorize - com auth
router.get('/google/authorize', authMiddleware, (req: Request, res: Response) => {
  try {
    const url = getAuthorizationUrl(req.user!.userId, req.user!.tenantId)
    res.json({ success: true, data: { url } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } })
  }
})

// Callback - SEM auth
router.get('/google/callback', async (req: Request, res: Response) => {
  console.log('=== CALLBACK ATINGIDO ===')
  console.log('Query:', JSON.stringify(req.query))
  res.json({ ok: true, callback: true, query: req.query })
})

// Status - com auth
router.get('/google/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus(req.user!.userId)
    res.json({ success: true, data: status })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'OAUTH_ERROR', message: error.message } })
  }
})

export default router
