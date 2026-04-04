import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getDashboard } from '../controllers/reports.controller'

const router = Router()

router.use(authMiddleware)

router.get('/dashboard', getDashboard)

export default router
