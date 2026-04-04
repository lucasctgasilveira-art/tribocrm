import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getDashboard, getGestaoReports } from '../controllers/reports.controller'

const router = Router()

router.use(authMiddleware)

router.get('/dashboard', getDashboard)
router.get('/gestao', getGestaoReports)

export default router
