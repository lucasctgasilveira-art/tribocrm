import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { generateApiKey } from '../middleware/api-key-auth.middleware'

// CRUD de API keys do tenant logado. Acesso via JWT do CRM (não pela
// API pública). Apenas OWNER, MANAGER e SUPER_ADMIN (em dual-access)
// criam/revogam — TEAM_LEADER e SELLER apenas listam. SUPER_ADMIN
// está incluído porque o Lucas, quando alterna pra modo gestor pra
// testar, mantém role=SUPER_ADMIN no JWT mas tenantId vira o
// linkedTenantId (ver auth.middleware) — bloqueá-lo aqui impediria
// suporte/teste de criar keys do lado do tenant.
//
// SEGURANÇA CRÍTICA: a key em texto plano só aparece UMA VEZ no POST
// /api-keys (response da criação). Depois disso, só o hash fica no
// banco. Se o user perder, a única solução é revogar e criar nova.

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN'
}

// ─── GET /api-keys ───────────────────────────────────────────────
//
// Lista todas as keys do tenant (revogadas e ativas). Inclui prefix
// pra identificação visual e lastUsedAt pra ver se a key está ativa.
export async function listApiKeys(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId

  try {
    const keys = await prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: keys })
  } catch (error: any) {
    console.error('[ApiKeys] list error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar API keys' } })
  }
}

// ─── POST /api-keys ──────────────────────────────────────────────
//
// Cria nova key. Body: { name: string }. Retorna a key em texto plano
// UMA ÚNICA VEZ — o frontend mostra modal "copie agora ou perderá".
export async function createApiKey(req: Request, res: Response): Promise<void> {
  const { tenantId, userId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem criar API keys' } })
    return
  }

  // SUPER_ADMIN sem dual-access fica com tenantId="platform" (sentinel
  // — não é UUID válido). FK do api_keys.tenant_id pra tenants.id
  // explodiria com erro genérico. Bloqueia aqui com mensagem clara.
  if (tenantId === 'platform') {
    res.status(400).json({ success: false, error: { code: 'NO_TENANT_CONTEXT', message: 'SUPER_ADMIN precisa estar no modo gestor de um tenant pra criar API key.' } })
    return
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!name) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' } })
    return
  }
  if (name.length > 100) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name excede 100 caracteres' } })
    return
  }

  // Limite por tenant: 20 keys ativas. Tenant que precisar de mais
  // pode revogar antigas. Previne abuso (cada key consome bucket de
  // rate limit em memória).
  const activeCount = await prisma.apiKey.count({
    where: { tenantId, revokedAt: null },
  })
  if (activeCount >= 20) {
    res.status(409).json({
      success: false,
      error: { code: 'LIMIT_REACHED', message: 'Limite de 20 keys ativas. Revogue alguma antes de criar nova.' },
    })
    return
  }

  const { plain, hash, prefix } = generateApiKey()

  // SUPER_ADMIN tem userId que aponta pra admin_users, NÃO pra users.
  // Tentar gravar em created_by (FK pra users.id) explode com violação
  // de FK. Mesmo padrão usado em managerial_tasks.created_by — pra
  // SUPER_ADMIN, registramos NULL e a UI mostra "—" como criador.
  const createdBy = role === 'SUPER_ADMIN' ? null : userId

  try {
    const created = await prisma.apiKey.create({
      data: {
        tenantId,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        createdBy,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
    })

    // Resposta com a key plain — única vez que aparece.
    res.status(201).json({
      success: true,
      data: {
        ...created,
        key: plain,
      },
    })
  } catch (error: any) {
    // Log estruturado pra capturar code do Prisma (P2003 = FK violation,
    // P2002 = unique). Erro genérico no client mas mensagem precisa
    // no Sentry/Railway logs.
    console.error('[ApiKeys] create error:', {
      code: error?.code,
      meta: error?.meta,
      message: error?.message,
      role,
      tenantId,
    })
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar API key' } })
  }
}

// ─── DELETE /api-keys/:id ────────────────────────────────────────
//
// Revoga a key (soft-delete via revokedAt). Não deleta a linha pra
// preservar histórico de uso (lastUsedAt) e auditoria.
export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  const { tenantId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem revogar API keys' } })
    return
  }

  const id = req.params.id as string

  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id, tenantId },
      select: { id: true, revokedAt: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API key não encontrada' } })
      return
    }
    if (existing.revokedAt) {
      res.status(409).json({ success: false, error: { code: 'ALREADY_REVOKED', message: 'API key já estava revogada' } })
      return
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('[ApiKeys] revoke error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao revogar API key' } })
  }
}
