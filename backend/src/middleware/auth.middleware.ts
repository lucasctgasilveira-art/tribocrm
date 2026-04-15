import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

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

// Small in-process cache for the email_verified lookup. Every
// authenticated request runs this middleware, so a DB hit per call
// would be wasteful. Entries are keyed by userId and kept for 60s —
// long enough to amortize normal traffic, short enough that a user
// clicking the verification link starts being let through within a
// minute without manual intervention.
const VERIFIED_CACHE_TTL_MS = 60_000
const verifiedCache = new Map<string, { verified: boolean; expiresAt: number }>()

async function isEmailVerified(userId: string): Promise<boolean> {
  const cached = verifiedCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.verified

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  })
  const verified = !!user?.emailVerified
  verifiedCache.set(userId, { verified, expiresAt: Date.now() + VERIFIED_CACHE_TTL_MS })
  return verified
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  let decoded: JwtPayload
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not configured')

    decoded = jwt.verify(token, secret) as JwtPayload
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Token inválido ou expirado' },
    })
    return
  }

  // Email-verification gate. Only applies to real tenant users — the
  // SUPER_ADMIN role lives in admin_users, which has no email_verified
  // column and no signup flow, so we skip the check there.
  if (decoded.role !== 'SUPER_ADMIN') {
    try {
      const verified = await isEmailVerified(decoded.userId)
      if (!verified) {
        res.status(403).json({
          success: false,
          error: { code: 'EMAIL_NOT_VERIFIED', message: 'Confirme seu e-mail antes de acessar.' },
        })
        return
      }
    } catch (err: any) {
      console.error('[Auth] email verification lookup failed:', err?.message ?? err)
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao validar sessão' },
      })
      return
    }
  }

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
}
