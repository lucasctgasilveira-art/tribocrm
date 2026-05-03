/**
 * Endpoints pra Web Push subscriptions.
 *
 *   GET    /push/vapid-public-key  → frontend pega a chave pública
 *   POST   /push/subscribe         → registra subscription do device
 *   DELETE /push/unsubscribe       → remove subscription do device
 *
 * Frontend chama o subscribe APÓS o user aceitar o pre-prompt e o
 * navegador retornar uma subscription válida via PushManager.subscribe().
 * O endpoint é único por device/origem — re-subscribe é idempotente
 * via upsert no @@unique([userId, endpoint]).
 */

import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { getVapidPublicKey } from '../services/push-notification.service'

export async function getVapidPublicKeyEndpoint(_req: Request, res: Response): Promise<void> {
  const key = getVapidPublicKey()
  if (!key) {
    res.status(503).json({
      success: false,
      error: { code: 'PUSH_NOT_CONFIGURED', message: 'Push notifications não estão configuradas no servidor' },
    })
    return
  }
  res.json({ success: true, data: { publicKey: key } })
}

interface SubscribeBody {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  userAgent?: string
}

export async function subscribePush(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const body = req.body as SubscribeBody

    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'endpoint e keys (p256dh, auth) são obrigatórios' },
      })
      return
    }

    // Upsert via @@unique([userId, endpoint]) — re-subscribe atualiza
    // as keys (browsers podem regenerar). Não precisamos achar pelo id.
    const existing = await prisma.pushSubscription.findUnique({
      where: { userId_endpoint: { userId, endpoint: body.endpoint } },
    })

    if (existing) {
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent: body.userAgent ?? null,
        },
      })
    } else {
      await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent: body.userAgent ?? null,
        },
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('[push] subscribe error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

interface UnsubscribeBody {
  endpoint?: string
}

export async function unsubscribePush(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { endpoint } = (req.body ?? {}) as UnsubscribeBody

    if (!endpoint) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'endpoint é obrigatório' },
      })
      return
    }

    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
    res.json({ success: true })
  } catch (error) {
    console.error('[push] unsubscribe error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
