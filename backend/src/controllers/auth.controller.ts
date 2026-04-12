import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { loginSchema } from '../schemas/auth.schema'

const BCRYPT_ROUNDS = 12
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// In-memory store for login attempts (per email)
const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>()

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return secret
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured')
  return secret
}

function generateAccessToken(payload: { userId: string; tenantId: string; role: string }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' })
}

function generateRefreshToken(payload: { userId: string; tenantId: string; role: string }): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: '30d' })
}

// Set to track invalidated refresh tokens
const invalidatedTokens = new Set<string>()

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      })
      return
    }

    const { email, password } = parsed.data
    const emailLower = email.toLowerCase()

    // Check lockout
    const attempts = loginAttempts.get(emailLower)
    if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
      const minutesLeft = Math.ceil((attempts.lockedUntil - Date.now()) / 60000)
      res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Conta bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} minuto(s).`,
        },
      })
      return
    }

    // 1. Try admin_users first
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: emailLower },
    })

    if (adminUser && adminUser.isActive) {
      const passwordValid = await bcrypt.compare(password, adminUser.passwordHash)
      if (!passwordValid) {
        incrementLoginAttempts(emailLower)
        const current = loginAttempts.get(emailLower)
        const remaining = MAX_LOGIN_ATTEMPTS - (current?.count ?? 0)

        if (remaining <= 0) {
          res.status(429).json({
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
            },
          })
          return
        }

        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: `E-mail ou senha incorretos. ${remaining} tentativa(s) restante(s).`,
          },
        })
        return
      }

      // Admin login success
      loginAttempts.delete(emailLower)

      const tokenPayload = { userId: adminUser.id, tenantId: 'platform', role: adminUser.role }
      const accessToken = generateAccessToken(tokenPayload)
      const refreshToken = generateRefreshToken(tokenPayload)

      await prisma.adminUser.update({
        where: { id: adminUser.id },
        data: { lastLoginAt: new Date() },
      })

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      })

      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
            role: adminUser.role,
            tenantId: 'platform',
            avatarUrl: null,
            themePreference: 'DARK',
            // Surfaced for the LoginPage router: when true the client
            // lands on /admin/select-access instead of /admin/dashboard.
            isDualAccess: adminUser.isDualAccess,
          },
        },
      })
      return
    }

    // 2. Try users table
    const user = await prisma.user.findFirst({
      where: { email: emailLower, deletedAt: null },
      include: { tenant: true },
    })

    if (!user || !user.isActive) {
      incrementLoginAttempts(emailLower)
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' },
      })
      return
    }

    if (user.tenant.status === 'SUSPENDED' || user.tenant.status === 'CANCELLED') {
      res.status(403).json({
        success: false,
        error: { code: 'TENANT_INACTIVE', message: 'Sua empresa está com o acesso suspenso' },
      })
      return
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      incrementLoginAttempts(emailLower)
      const current = loginAttempts.get(emailLower)
      const remaining = MAX_LOGIN_ATTEMPTS - (current?.count ?? 0)

      if (remaining <= 0) {
        res.status(429).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
          },
        })
        return
      }

      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: `E-mail ou senha incorretos. ${remaining} tentativa(s) restante(s).`,
        },
      })
      return
    }

    // User login success
    loginAttempts.delete(emailLower)

    const tokenPayload = { userId: user.id, tenantId: user.tenantId, role: user.role }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        firstLoginAt: user.firstLoginAt ?? new Date(),
      },
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          avatarUrl: user.avatarUrl,
          themePreference: user.themePreference,
          tenantName: user.tenant.tradeName ?? user.tenant.name,
          // Wizard state consumed by the gestor-side OnboardingWizard
          // overlay. Only meaningful for MANAGER/OWNER roles.
          onboardingCompleted: user.tenant.onboardingCompleted,
          onboardingStep: user.tenant.onboardingStep,
        },
      },
    })
  } catch (error) {
    console.error('[Auth] Login error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string>)?.refreshToken ?? req.body?.refreshToken

    if (!token || typeof token !== 'string') {
      res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token não fornecido' },
      })
      return
    }

    if (invalidatedTokens.has(token)) {
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'Refresh token foi revogado' },
      })
      return
    }

    const decoded = jwt.verify(token, getRefreshSecret()) as {
      userId: string
      tenantId: string
      role: string
    }

    let tokenPayload: { userId: string; tenantId: string; role: string }

    if (decoded.tenantId === 'platform') {
      // Admin user refresh
      const adminUser = await prisma.adminUser.findFirst({
        where: { id: decoded.userId, isActive: true },
      })
      if (!adminUser) {
        res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' },
        })
        return
      }
      tokenPayload = { userId: adminUser.id, tenantId: 'platform', role: adminUser.role }
    } else {
      const user = await prisma.user.findFirst({
        where: { id: decoded.userId, tenantId: decoded.tenantId, isActive: true, deletedAt: null },
      })
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' },
        })
        return
      }
      tokenPayload = { userId: user.id, tenantId: user.tenantId, role: user.role }
    }
    const accessToken = generateAccessToken(tokenPayload)
    const newRefreshToken = generateRefreshToken(tokenPayload)

    // Invalidate old refresh token
    invalidatedTokens.add(token)

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      success: true,
      data: { accessToken },
    })
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Refresh token inválido ou expirado' },
    })
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string>)?.refreshToken

    if (token) {
      invalidatedTokens.add(token)
    }

    res.clearCookie('refreshToken', { path: '/' })

    res.json({
      success: true,
      data: { message: 'Logout realizado com sucesso' },
    })
  } catch (error) {
    console.error('[Auth] Logout error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// Helper: hash password (exported for seed/registration use)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

function incrementLoginAttempts(email: string): void {
  const current = loginAttempts.get(email) ?? { count: 0, lockedUntil: null }
  current.count += 1

  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
  }

  loginAttempts.set(email, current)
}
