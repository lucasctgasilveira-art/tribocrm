import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getUsers, createUser, updateUser, resetUserPassword,
  getTeams, createTeam, updateTeam,
} from '../controllers/users.controller'

const router = Router()

router.use(authMiddleware)

// Users
router.get('/users', getUsers)
router.post('/users', createUser)
router.patch('/users/:id', updateUser)
router.patch('/users/:id/reset-password', resetUserPassword)

// Teams
router.get('/teams', getTeams)
router.post('/teams', createTeam)
router.patch('/teams/:id', updateTeam)

export default router
