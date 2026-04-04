import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getTasks,
  createTask,
  completeTask,
  updateTask,
  deleteTask,
  getManagerialTasks,
  createManagerialTask,
  completeManagerialTask,
} from '../controllers/tasks.controller'

const router = Router()

router.use(authMiddleware)

// Lead tasks
router.get('/', getTasks)
router.post('/', createTask)
router.patch('/:id', updateTask)
router.patch('/:id/complete', completeTask)
router.delete('/:id', deleteTask)

// Managerial tasks
router.get('/managerial', getManagerialTasks)
router.post('/managerial', createManagerialTask)
router.patch('/managerial/:id/complete', completeManagerialTask)

export default router
