import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  listWebhooks, createWebhook, updateWebhook, deleteWebhook,
  testWebhook, getWebhookSecret, listDeliveries, resendWebhookDelivery,
} from '../controllers/webhooks.controller'

// Gestão de webhooks de saída do tenant. Acesso via JWT do CRM.
// IMPORTANTE: nome da rota é "webhook-endpoints" pra NÃO colidir com
// /webhooks que já existe (handler de webhooks de ENTRADA da Efi).
// O frontend usa esse caminho (/webhook-endpoints) pra falar com o
// backend; a UI mostra como "Webhooks" pro usuário final.

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', listWebhooks)
router.post('/', createWebhook)
router.patch('/:id', updateWebhook)
router.delete('/:id', deleteWebhook)
router.post('/:id/test', testWebhook)
router.get('/:id/secret', getWebhookSecret)
router.get('/:id/deliveries', listDeliveries)
router.post('/deliveries/:deliveryId/resend', resendWebhookDelivery)

export default router
