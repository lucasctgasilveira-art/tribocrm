import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const tenantId = req.user!.tenantId
    const { unreadOnly } = req.query as Record<string, string | undefined>

    const where: { tenantId: string; userId: string; isRead?: boolean } = { tenantId, userId }

    if (unreadOnly === 'true') where.isRead = false

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: { tenantId, userId, isRead: false },
      }),
    ])

    res.json({
      success: true,
      data: notifications,
      meta: { unreadCount },
    })
  } catch (error: any) {
    console.error('[Notifications] getNotifications error:', error.message, error.code)
    // Return empty data gracefully if table doesn't exist or query fails
    res.json({
      success: true,
      data: [],
      meta: { unreadCount: 0 },
    })
  }
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const userId = req.user!.userId
    const tenantId = req.user!.tenantId

    const existing = await prisma.notification.findFirst({
      where: { id, userId, tenantId },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notificação não encontrada' },
      })
      return
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    res.json({ success: true, data: notification })
  } catch (error) {
    console.error('[Notifications] markAsRead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const tenantId = req.user!.tenantId

    const result = await prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    })

    res.json({ success: true, data: { count: result.count } })
  } catch (error) {
    console.error('[Notifications] markAllAsRead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
