import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const router = Router()
router.use(authMiddleware)

// Lista botões ativos, ordenados. Usado pelo AppLayout do cliente
// pra montar a seção "Tribo" no menu lateral. Super admin não vê
// (defesa em camadas — frontend também filtra).
router.get('/active', async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'SUPER_ADMIN' && !req.user!.linkedTenantId) {
      res.json({ success: true, data: [] })
      return
    }
    const buttons = await prisma.menuButton.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
    res.json({ success: true, data: buttons })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

export default router
