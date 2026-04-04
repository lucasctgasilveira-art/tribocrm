import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  getWhatsappTemplates, createWhatsappTemplate, updateWhatsappTemplate, deleteWhatsappTemplate,
} from '../controllers/templates.controller'

const router = Router()

router.use(authMiddleware)

// Email
router.get('/email', getEmailTemplates)
router.post('/email', createEmailTemplate)
router.patch('/email/:id', updateEmailTemplate)
router.delete('/email/:id', deleteEmailTemplate)

// WhatsApp
router.get('/whatsapp', getWhatsappTemplates)
router.post('/whatsapp', createWhatsappTemplate)
router.patch('/whatsapp/:id', updateWhatsappTemplate)
router.delete('/whatsapp/:id', deleteWhatsappTemplate)

export default router
