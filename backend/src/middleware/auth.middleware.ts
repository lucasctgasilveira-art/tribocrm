import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  userId: string
  tenantId: string
  role: string
  teamId: string | null
  // Present only for dual-access super admins. The middleware swaps
  // tenantId to this value on every non-/admin request so gestor
  // endpoints query the linked tenant instead of the platform
  // sentinel. See schema comment on AdminUser.linkedTenantId.
  linkedTenantId?: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const queryToken = req.query.token as string | undefined

  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token não fornecido' },
    })
    return
  }

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not configured')

    const decoded = jwt.verify(token, secret) as JwtPayload

    // Dual-access tenant swap. When the caller is a super admin with
    // linkedTenantId AND they are NOT hitting an /admin route, we
    // rewrite req.user.tenantId so every downstream query scoped by
    // tenantId transparently targets their linked tenant. Keeps all
    // existing controllers unchanged — they keep reading
    // req.user.tenantId and get the right value on both sides.
    //
    // /admin routes are left untouched so the Super Admin panel (and
    // admin.middleware's `tenantId === 'platform'` gate) keep working.
    const path = req.originalUrl || req.url || ''
    const isAdminRoute = path.startsWith('/admin')
    const effectiveTenantId = (
      decoded.role === 'SUPER_ADMIN' &&
      decoded.linkedTenantId &&
      !isAdminRoute
    )
      ? decoded.linkedTenantId
      : decoded.tenantId

    req.user = {
      userId: decoded.userId,
      tenantId: effectiveTenantId,
      role: decoded.role,
      teamId: decoded.teamId ?? null,
      linkedTenantId: decoded.linkedTenantId ?? null,
    }
    next()
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Token inválido ou expirado' },
    })
  }
}
