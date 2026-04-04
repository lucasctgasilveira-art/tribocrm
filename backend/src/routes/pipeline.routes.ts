import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getPipelines, getKanban, createPipeline } from '../controllers/pipeline.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', getPipelines)
router.get('/:id/kanban', getKanban)
router.post('/', createPipeline)

export default router
