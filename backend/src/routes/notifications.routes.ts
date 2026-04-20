import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notifications.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', getNotifications)
router.patch('/read-all', markAllAsRead)
router.patch('/:id/read', markAsRead)

export default router
