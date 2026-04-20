import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getAutomations, createAutomation, updateAutomation, deleteAutomation, getAutomationLogs,
} from '../controllers/automations.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', getAutomations)
router.post('/', createAutomation)
router.patch('/:id', updateAutomation)
router.delete('/:id', deleteAutomation)
router.get('/:id/logs', getAutomationLogs)

export default router
