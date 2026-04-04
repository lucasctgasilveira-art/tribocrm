import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getGoals, getGoalDashboard, createGoal, updateGoal } from '../controllers/goals.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', getGoals)
router.get('/dashboard', getGoalDashboard)
router.post('/', createGoal)
router.patch('/:id', updateGoal)

export default router
