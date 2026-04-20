import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

// Cache in-memory de 30s (reduz queries redundantes sem impactar UX
// pós-pagamento — cliente que paga vê acesso liberado em até 30s)
const CACHE_TTL_MS = 30_000

interface CacheEntry {
  status: string
  cachedAt: number
}

const statusCache = new Map<string, CacheEntry>()

export async function tenantStatusGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = (req as any).user
    if (!user?.tenantId) {
      return next()
    }

    if (user.role === 'SUPER_ADMIN') {
      return next()
    }

    const now = Date.now()
    const cached = statusCache.get(user.tenantId)

    let status: string
    if (cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
      status = cached.status
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true },
      })
      if (!tenant) {
        res.status(404).json({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant não encontrado' },
        })
        return
      }
      status = tenant.status
      statusCache.set(user.tenantId, { status, cachedAt: now })
    }

    if (status === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_SUSPENDED',
          message: 'Sua conta está suspensa por falta de pagamento. Acesse a seção de Assinatura para regularizar.',
        },
      })
      return
    }

    if (status === 'CANCELLED') {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_CANCELLED',
          message: 'Sua conta foi cancelada. Entre em contato com o suporte.',
        },
      })
      return
    }

    next()
  } catch (err) {
    console.error('[tenantStatusGuard] unexpected error:', err)
    return next()
  }
}

export function invalidateTenantStatusCache(tenantId?: string): void {
  if (tenantId) {
    statusCache.delete(tenantId)
  } else {
    statusCache.clear()
  }
}
