import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { listApiKeys, createApiKey, revokeApiKey } from '../controllers/api-keys.controller'

// Gestão de API keys do tenant logado. Acesso via JWT do CRM (não pela
// API pública). Listagem aberta a todos os roles do tenant; criar e
// revogar exigem OWNER ou MANAGER (validado no controller).

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', listApiKeys)
router.post('/', createApiKey)
router.delete('/:id', revokeApiKey)

export default router
