import { Router, Request, Response } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { prisma } from '../lib/prisma'
import {
  getUsers, createUser, updateUser, resetUserPassword,
  getTeams, createTeam, updateTeam,
  getInactivationImpact, inactivateUserWithGoal,
} from '../controllers/users.controller'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { cb(null, file.mimetype.startsWith('image/')) } })

router.use(authMiddleware)
router.use(tenantStatusGuard)

// Me
router.patch('/users/me', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const data: Record<string, unknown> = {}

    if (req.body.name) data.name = req.body.name
    if (req.body.phone) data.phone = req.body.phone

    if (req.file) {
      console.log('[Users] Avatar upload:', req.file.originalname, req.file.size, 'bytes')
      try {
        const compressed = await sharp(req.file.buffer)
          .resize(200, 200, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer()
        console.log('[Users] Compressed avatar:', compressed.length, 'bytes')
        data.avatarUrl = `data:image/webp;base64,${compressed.toString('base64')}`
      } catch (sharpErr: any) {
        console.error('[Users] Sharp compression failed, using size check fallback:', sharpErr.message)
        if (req.file.size > 500 * 1024) {
          res.status(400).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Imagem muito grande. Maximo 500KB.' } })
          return
        }
        data.avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true },
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Users] PATCH /users/me error:', error.message, error.stack)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// Users
router.get('/users', getUsers)
router.post('/users', createUser)
router.patch('/users/:id', updateUser)
router.patch('/users/:id/reset-password', resetUserPassword)

// Inativação com saldo de meta (Bug 4 Fase C — Doc seções 6.9 e 13.7).
// Frontend chama o GET pra mostrar modal de confirmação com info do
// saldo. POST faz a inativação + (re)distribuição segundo flag boolean.
router.get('/users/:id/inactivation-impact', getInactivationImpact)
router.post('/users/:id/inactivate-with-goal', inactivateUserWithGoal)

// Acesso a pipelines por usuario.
// GET retorna lista de pipelineIds que o usuario tem acesso.
// PUT substitui o conjunto inteiro (estilo replace, mais simples
// que add/remove individual). OWNER e SUPER_ADMIN ignoram a tabela
// — os endpoints retornam vazio/no-op pra eles.
router.get('/users/:id/pipelines', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.params.id as string

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true, role: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuario nao encontrado' } })
      return
    }

    if (user.role === 'OWNER') {
      // OWNER ve todas — devolve todas as pipelines ativas do tenant
      // pra UI mostrar "todas" sem precisar de logica especial.
      const all = await prisma.pipeline.findMany({
        where: { tenantId, isActive: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      res.json({ success: true, data: { pipelineIds: all.map(p => p.id), isOwner: true } })
      return
    }

    const accesses = await prisma.userPipelineAccess.findMany({
      where: { userId, tenantId },
      select: { pipelineId: true },
    })
    res.json({ success: true, data: { pipelineIds: accesses.map(a => a.pipelineId), isOwner: false } })
  } catch (error: any) {
    console.error('[Users] GET /users/:id/pipelines error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.put('/users/:id/pipelines', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId
    const callerRole = req.user!.role
    const userId = req.params.id as string
    const { pipelineIds } = req.body ?? {}

    // So OWNER/SUPER_ADMIN podem alterar acessos. MANAGER nao
    // configura outros usuarios.
    if (callerRole !== 'OWNER' && callerRole !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas OWNER pode configurar acessos' } })
      return
    }

    if (!Array.isArray(pipelineIds)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'pipelineIds deve ser array' } })
      return
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true, role: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuario nao encontrado' } })
      return
    }

    if (user.role === 'OWNER') {
      // OWNER ve tudo por padrao. Sem necessidade de gravar linhas
      // — retornamos sucesso sem mexer.
      res.json({ success: true, data: { pipelineIds, isOwner: true } })
      return
    }

    // Valida que todas as pipelineIds informadas existem no tenant.
    const validPipelines = await prisma.pipeline.findMany({
      where: { id: { in: pipelineIds }, tenantId, isActive: true },
      select: { id: true },
    })
    const validIds = new Set(validPipelines.map(p => p.id))
    const invalidIds = pipelineIds.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Pipelines invalidos: ${invalidIds.join(', ')}` },
      })
      return
    }

    // Replace transacional: deleta acessos existentes do user e insere
    // os novos. Mais simples e idempotente que add/remove diff.
    await prisma.$transaction(async (tx) => {
      await tx.userPipelineAccess.deleteMany({ where: { userId, tenantId } })
      if (pipelineIds.length > 0) {
        await tx.userPipelineAccess.createMany({
          data: pipelineIds.map((pid: string) => ({ tenantId, userId, pipelineId: pid })),
        })
      }
    })

    res.json({ success: true, data: { pipelineIds, isOwner: false } })
  } catch (error: any) {
    console.error('[Users] PUT /users/:id/pipelines error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// Teams
router.get('/teams', getTeams)
router.post('/teams', createTeam)
router.patch('/teams/:id', updateTeam)

export default router
