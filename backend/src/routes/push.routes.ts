import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getVapidPublicKeyEndpoint, subscribePush, unsubscribePush,
} from '../controllers/push.controller'

const router = Router()

// VAPID public key é "pública" mas exige user autenticado pra evitar
// bots vasculhando o servidor — a chave em si não é segredo.
router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/vapid-public-key', getVapidPublicKeyEndpoint)
router.post('/subscribe', subscribePush)
router.delete('/unsubscribe', unsubscribePush)

export default router
