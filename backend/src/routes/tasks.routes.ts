import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { prisma } from '../lib/prisma'
import { resolveTenantId } from '../lib/platformTenant'
import {
  getTasks,
  createTask,
  completeTask,
  updateTask,
  deleteTask,
  getManagerialTasks,
  createManagerialTask,
  updateManagerialTask,
  completeManagerialTask,
} from '../controllers/tasks.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

// ── Managerial task types (MUST be before /:id routes) ──

router.get('/managerial-types', async (req: Request, res: Response) => {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const userRole = req.user!.role
    const queryRole = req.query.role as string | undefined
    const types = await prisma.managerialTaskType.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    // SUPER_ADMIN sees every type regardless of visibleFor (platform-level view)
    const filtered = userRole === 'SUPER_ADMIN' || !queryRole
      ? types
      : types.filter(t => t.visibleFor.includes(queryRole))
    // Dedupe by name — pre-existing DB duplicates (from legacy concurrent
    // seeding before the in-memory guard) would otherwise repeat in the
    // dropdown. Keep the lowest sortOrder / oldest record.
    const seen = new Set<string>()
    const deduped = filtered.filter(t => {
      if (seen.has(t.name)) return false
      seen.add(t.name)
      return true
    })
    res.json({ success: true, data: deduped })
  } catch (error: any) {
    console.error('[Tasks] getManagerialTypes error:', error.message)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.post('/managerial-types', async (req: Request, res: Response) => {
  try {
    console.log('[MANAGERIAL_TYPE_CREATE] body:', JSON.stringify(req.body), 'user:', JSON.stringify(req.user))
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const { name, visibleFor } = req.body
    if (!name) { res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'name é obrigatório' } }); return }
    const maxOrder = await prisma.managerialTaskType.aggregate({ where: { tenantId }, _max: { sortOrder: true } })
    console.log('[MANAGERIAL_TYPE_CREATE] maxOrder:', maxOrder)
    const type = await prisma.managerialTaskType.create({
      data: { tenantId, name, visibleFor: visibleFor ?? ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER'], sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    })
    console.log('[MANAGERIAL_TYPE_CREATE] success:', type.id)
    res.json({ success: true, data: type })
  } catch (error: any) {
    console.error('MANAGERIAL_TYPE_CREATE_ERROR:', error)
    res.status(500).json({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: error.message ?? 'Unknown error',
        name: error.name ?? null,
        meta: error.meta ?? null,
        stack: error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : null,
      },
    })
  }
})

router.patch('/managerial-types/:id', async (req: Request, res: Response) => {
  try {
    console.log('[MANAGERIAL_TYPE_UPDATE] id:', req.params.id, 'body:', JSON.stringify(req.body))
    const { name, visibleFor, isActive } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (visibleFor !== undefined) data.visibleFor = visibleFor
    if (isActive !== undefined) data.isActive = isActive
    const type = await prisma.managerialTaskType.update({ where: { id: req.params.id as string }, data })
    res.json({ success: true, data: type })
  } catch (error: any) {
    console.error('MANAGERIAL_TYPE_UPDATE_ERROR:', error)
    res.status(500).json({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: error.message ?? 'Unknown error',
        name: error.name ?? null,
        meta: error.meta ?? null,
        stack: error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : null,
      },
    })
  }
})

// ── Managerial tasks ──

router.get('/managerial', getManagerialTasks)
router.post('/managerial', createManagerialTask)
router.patch('/managerial/:id/complete', completeManagerialTask)
router.patch('/managerial/:id', updateManagerialTask)

// ── Lead tasks ──

router.get('/', getTasks)
router.post('/', createTask)
router.patch('/:id/complete', completeTask)
router.patch('/:id', updateTask)
router.delete('/:id', deleteTask)

export default router
