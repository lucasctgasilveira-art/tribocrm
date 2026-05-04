import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'

// Auth para a API pública v1. Espera header:
//   Authorization: Bearer tcrm_live_<32 chars hex>
//
// Lookup por hash SHA-256: nunca comparamos a key em texto plano,
// apenas o hash. A coluna api_keys.key_hash tem unique constraint, então
// um único findUnique resolve.
//
// Side effect: atualiza last_used_at best-effort (fire-and-forget). Se
// a query falhar não bloqueamos o request — observabilidade não vale
// downtime.
//
// Bloqueios:
//   1. Header ausente ou mal-formado → 401 UNAUTHORIZED
//   2. Key não encontrada → 401 INVALID_API_KEY
//   3. Key revogada → 401 API_KEY_REVOKED
//   4. Tenant suspenso/cancelado → 403 TENANT_SUSPENDED/CANCELLED
//
// Em caso de sucesso, popula req.apiKey { tenantId, apiKeyId } e
// req.user (compat com controllers existentes que esperam req.user.tenantId).
// req.user.userId é null porque não é um humano logado — qualquer
// controller que dependa de userId concreto precisa lidar com isso.

interface ApiKeyContext {
  tenantId: string
  apiKeyId: string
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext
    }
  }
}

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Header Authorization Bearer ausente.' },
    })
    return
  }

  const rawKey = authHeader.slice('Bearer '.length).trim()
  if (!rawKey || !rawKey.startsWith('tcrm_')) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Formato de API key inválido.' },
    })
    return
  }

  const keyHash = hashKey(rawKey)

  let apiKey: { id: string; tenantId: string; revokedAt: Date | null } | null
  try {
    apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, tenantId: true, revokedAt: true },
    })
  } catch (err) {
    console.error('[apiKeyAuth] erro ao buscar key:', err)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao validar credenciais.' },
    })
    return
  }

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'API key inválida.' },
    })
    return
  }

  if (apiKey.revokedAt) {
    res.status(401).json({
      success: false,
      error: { code: 'API_KEY_REVOKED', message: 'Esta API key foi revogada.' },
    })
    return
  }

  // Bloqueia tenants inativos. Espelha o tenantStatusGuard mas inline
  // (não dá pra reusar o guard atual porque ele lê req.user.tenantId,
  // que aqui ainda não foi populado — e o guard vem depois desse mw).
  let tenantStatus: string
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: apiKey.tenantId },
      select: { status: true },
    })
    if (!tenant) {
      res.status(404).json({
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant não encontrado.' },
      })
      return
    }
    tenantStatus = tenant.status
  } catch (err) {
    console.error('[apiKeyAuth] erro ao buscar tenant:', err)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao validar tenant.' },
    })
    return
  }

  if (tenantStatus === 'SUSPENDED') {
    res.status(403).json({
      success: false,
      error: { code: 'TENANT_SUSPENDED', message: 'Conta suspensa por falta de pagamento.' },
    })
    return
  }
  if (tenantStatus === 'CANCELLED') {
    res.status(403).json({
      success: false,
      error: { code: 'TENANT_CANCELLED', message: 'Conta cancelada.' },
    })
    return
  }

  // Atualiza lastUsedAt sem bloquear (best-effort).
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => { /* observabilidade — silencioso */ })

  req.apiKey = { tenantId: apiKey.tenantId, apiKeyId: apiKey.id }

  // Compat: controllers existentes leem req.user.tenantId. Populamos
  // com role API_KEY pra distinguir de usuário humano. userId vazio
  // sinaliza "não tem ator humano" (controllers de leads etc. precisam
  // tolerar isso pros campos createdBy).
  req.user = {
    userId: '',
    tenantId: apiKey.tenantId,
    role: 'API_KEY',
    teamId: null,
    linkedTenantId: null,
  }

  next()
}

// Helper exportado pro controller de gestão de keys (geração da key
// real + hash). O controller chama isto, salva o hash, e retorna a
// key plain text UMA ÚNICA VEZ.
export function generateApiKey(): { plain: string; hash: string; prefix: string } {
  // 32 bytes hex = 64 chars. Total: "tcrm_live_" + 64 = 74 chars.
  const random = crypto.randomBytes(32).toString('hex')
  const plain = `tcrm_live_${random}`
  const hash = hashKey(plain)
  // Primeiros 16 chars (tcrm_live_ + 6 hex). Mostrado na lista pra user
  // identificar visualmente sem revelar a key inteira.
  const prefix = plain.slice(0, 16)
  return { plain, hash, prefix }
}
