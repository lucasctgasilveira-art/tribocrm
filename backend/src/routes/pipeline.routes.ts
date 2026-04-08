import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getPipelines, getKanban, createPipeline, updatePipeline } from '../controllers/pipeline.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', getPipelines)
router.get('/:id/kanban', getKanban)
router.post('/', createPipeline)
router.patch('/:id', updatePipeline)

export default router
