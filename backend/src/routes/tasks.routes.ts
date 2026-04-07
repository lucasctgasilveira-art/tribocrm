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

// Managerial task types
router.get('/managerial-types', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId
    const role = req.query.role as string | undefined
    const where: Record<string, unknown> = { tenantId, isActive: true }
    const types = await (await import('../lib/prisma')).prisma.managerialTaskType.findMany({
      where, orderBy: { sortOrder: 'asc' },
    })
    const filtered = role ? types.filter((t: any) => (t.visibleFor as string[]).includes(role)) : types
    res.json({ success: true, data: filtered })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.post('/managerial-types', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId
    const { name, visibleFor } = req.body
    if (!name) { res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'name é obrigatório' } }); return }
    const maxOrder = await (await import('../lib/prisma')).prisma.managerialTaskType.aggregate({ where: { tenantId }, _max: { sortOrder: true } })
    const type = await (await import('../lib/prisma')).prisma.managerialTaskType.create({
      data: { tenantId, name, visibleFor: visibleFor ?? ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER'], sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    })
    res.json({ success: true, data: type })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.patch('/managerial-types/:id', async (req, res) => {
  try {
    const { name, visibleFor, isActive } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (visibleFor !== undefined) data.visibleFor = visibleFor
    if (isActive !== undefined) data.isActive = isActive
    const type = await (await import('../lib/prisma')).prisma.managerialTaskType.update({ where: { id: req.params.id }, data })
    res.json({ success: true, data: type })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// Managerial tasks
router.get('/managerial', getManagerialTasks)
router.post('/managerial', createManagerialTask)
router.patch('/managerial/:id/complete', completeManagerialTask)

export default router
