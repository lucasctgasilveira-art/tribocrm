import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { getForms, createForm, updateForm, deleteForm, getFormStats } from '../controllers/forms.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', getForms)
router.get('/stats', getFormStats)
router.post('/', createForm)
router.patch('/:id', updateForm)
router.delete('/:id', deleteForm)

export default router
