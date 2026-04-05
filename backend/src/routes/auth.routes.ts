import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { login, refresh, logout } from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const router = Router()

router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)

router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Senha atual e nova senha sao obrigatorias' } })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, passwordHash: true } })
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuario nao encontrado' } }); return }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) { res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Senha atual incorreta' } }); return }

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })

    res.json({ success: true, data: { message: 'Senha alterada com sucesso' } })
  } catch (error: any) {
    console.error('[Auth] change-password error:', error.message)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } })
  }
})

export default router
