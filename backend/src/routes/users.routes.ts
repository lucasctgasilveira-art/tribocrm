import { Router, Request, Response } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import {
  getUsers, createUser, updateUser, resetUserPassword,
  getTeams, createTeam, updateTeam,
} from '../controllers/users.controller'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { cb(null, file.mimetype.startsWith('image/')) } })

router.use(authMiddleware)

// Me
router.patch('/users/me', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const data: Record<string, unknown> = {}

    if (req.body.name) data.name = req.body.name
    if (req.body.phone) data.phone = req.body.phone
    if (req.body.preferredPaymentMethod) data.themePreference = req.body.preferredPaymentMethod // reuse field

    if (req.file) {
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      data.avatarUrl = base64
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true },
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

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
