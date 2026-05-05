import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getTenantPartner, setTenantPartner, unsetTenantPartner, validatePartnerCode,
} from '../controllers/tenant-partner.controller'

// Endpoints do gestor pra gerenciar o parceiro vinculado ao tenant.
// /validate/:code aceita qualquer user autenticado (gestor ou vendedor)
// — só verifica se o código existe e está ativo, retornando nome.
// /tenant-partner (GET/POST/DELETE) restringe a OWNER/MANAGER no controller.

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/validate/:code', validatePartnerCode)
router.get('/', getTenantPartner)
router.post('/', setTenantPartner)
router.delete('/', unsetTenantPartner)

export default router
