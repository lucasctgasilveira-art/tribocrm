import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { getGoals, getGoalDashboard, createGoal, updateGoal, getAggregatedGoals } from '../controllers/goals.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', getGoals)
router.get('/dashboard', getGoalDashboard)
// Agregação por período composto (Bug 5 — Alternativa A). Soma metas
// mensais que compõem o período. Usado pra filtros Tri/Sem/Ano em
// GoalsPage e Dashboard.
router.get('/aggregated', getAggregatedGoals)
router.post('/', createGoal)
router.patch('/:id', updateGoal)

export default router
