import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notifications.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', getNotifications)
router.patch('/read-all', markAllAsRead)
router.patch('/:id/read', markAsRead)

export default router
