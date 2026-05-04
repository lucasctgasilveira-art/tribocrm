import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import {
  triggerWebhookEvent,
  resendDelivery,
  generateWebhookSecret,
  ALL_WEBHOOK_EVENTS,
  type WebhookEventType,
} from '../services/webhook-dispatcher.service'

// CRUD + ações (testar, reenviar) dos webhooks de saída do tenant.
// Acessado via JWT do CRM. Apenas OWNER, MANAGER e SUPER_ADMIN
// (em dual-access) gerenciam — TEAM_LEADER/SELLER apenas listam.

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN'
}

const MAX_ENDPOINTS_PER_TENANT = 10
const MAX_NAME_LENGTH = 100
const MAX_URL_LENGTH = 500
const LOGS_DEFAULT_LIMIT = 50
const LOGS_MAX_LIMIT = 200

// ─── GET /webhooks ──────────────────────────────────────────────
//
// Lista endpoints do tenant. Não retorna o secret na lista (mostra só
// na criação). Inclui contagem de deliveries pra UI mostrar saúde.
export async function listWebhooks(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId
  if (tenantId === 'platform') {
    res.json({ success: true, data: [] })
    return
  }

  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { id: true, name: true } },
        _count: {
          select: { deliveries: true },
        },
      },
    })
    res.json({ success: true, data: endpoints })
  } catch (error: any) {
    console.error('[Webhooks] list error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar webhooks' } })
  }
}

// ─── POST /webhooks ─────────────────────────────────────────────
//
// Body: { name, url, events: string[] }. Retorna o endpoint criado
// COM o secret em texto plano (única vez que aparece).
export async function createWebhook(req: Request, res: Response): Promise<void> {
  const { tenantId, userId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem criar webhooks' } })
    return
  }
  if (tenantId === 'platform') {
    res.status(400).json({ success: false, error: { code: 'NO_TENANT_CONTEXT', message: 'SUPER_ADMIN precisa estar em modo gestor pra criar webhook.' } })
    return
  }

  const { name, url, events } = req.body ?? {}

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' } })
    return
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `name excede ${MAX_NAME_LENGTH} caracteres` } })
    return
  }
  if (typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url é obrigatória' } })
    return
  }
  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `url excede ${MAX_URL_LENGTH} caracteres` } })
    return
  }
  // Aceita só http/https. Bloqueia javascript:/data:/file: que poderiam
  // virar SSRF se a gente fosse mais ingênuo (não é o caso aqui — a
  // gente faz fetch direto, mas é boa higiene mesmo assim).
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('protocolo inválido')
    }
  } catch {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url precisa ser http:// ou https://' } })
    return
  }

  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'events precisa ser array com pelo menos 1 evento' } })
    return
  }
  for (const e of events) {
    if (!ALL_WEBHOOK_EVENTS.includes(e as WebhookEventType)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `evento inválido: ${e}. Aceitos: ${ALL_WEBHOOK_EVENTS.join(', ')}` },
      })
      return
    }
  }

  const activeCount = await prisma.webhookEndpoint.count({
    where: { tenantId, isActive: true },
  })
  if (activeCount >= MAX_ENDPOINTS_PER_TENANT) {
    res.status(409).json({
      success: false,
      error: { code: 'LIMIT_REACHED', message: `Limite de ${MAX_ENDPOINTS_PER_TENANT} endpoints ativos. Desative ou exclua algum antes de criar novo.` },
    })
    return
  }

  const secret = generateWebhookSecret()
  const createdBy = role === 'SUPER_ADMIN' ? null : userId

  try {
    const created = await prisma.webhookEndpoint.create({
      data: {
        tenantId,
        name: name.trim(),
        url: url.trim(),
        secret,
        events,
        createdBy,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        secret: true,
        createdAt: true,
      },
    })
    res.status(201).json({ success: true, data: created })
  } catch (error: any) {
    console.error('[Webhooks] create error:', { code: error?.code, message: error?.message, role, tenantId })
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar webhook' } })
  }
}

// ─── PATCH /webhooks/:id ────────────────────────────────────────
//
// Edita name, url, events, isActive. Não permite mudar secret (pra isso
// teria que adicionar endpoint /regenerate-secret — fora do escopo v1).
export async function updateWebhook(req: Request, res: Response): Promise<void> {
  const { tenantId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem editar webhooks' } })
    return
  }

  const id = req.params.id as string
  const { name, url, events, isActive } = req.body ?? {}

  const data: any = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name inválido' } })
      return
    }
    data.name = name.trim()
  }
  if (url !== undefined) {
    if (typeof url !== 'string' || !url.trim() || url.length > MAX_URL_LENGTH) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url inválida' } })
      return
    }
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('proto')
    } catch {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url precisa ser http:// ou https://' } })
      return
    }
    data.url = url.trim()
  }
  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'events precisa ter pelo menos 1 evento' } })
      return
    }
    for (const e of events) {
      if (!ALL_WEBHOOK_EVENTS.includes(e as WebhookEventType)) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `evento inválido: ${e}` } })
        return
      }
    }
    data.events = events
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive)

  if (Object.keys(data).length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nada pra atualizar' } })
    return
  }

  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook não encontrado' } })
      return
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data,
      select: {
        id: true, name: true, url: true, events: true,
        isActive: true, createdAt: true, updatedAt: true,
      },
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Webhooks] update error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao atualizar webhook' } })
  }
}

// ─── DELETE /webhooks/:id ───────────────────────────────────────
//
// Hard-delete. Cascade apaga logs de delivery juntos.
export async function deleteWebhook(req: Request, res: Response): Promise<void> {
  const { tenantId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem excluir webhooks' } })
    return
  }

  const id = req.params.id as string
  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook não encontrado' } })
      return
    }
    await prisma.webhookEndpoint.delete({ where: { id } })
    res.json({ success: true })
  } catch (error: any) {
    console.error('[Webhooks] delete error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao excluir webhook' } })
  }
}

// ─── POST /webhooks/:id/test ────────────────────────────────────
//
// Dispara um evento "ping" pro endpoint pra validar se a configuração
// está certa. Cria delivery normal (com retry) — se cliente devolver
// 200, fica como SUCCESS na aba de Logs.
export async function testWebhook(req: Request, res: Response): Promise<void> {
  const { tenantId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem testar webhooks' } })
    return
  }

  const id = req.params.id as string
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
      select: { id: true, isActive: true, events: true },
    })
    if (!endpoint) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook não encontrado' } })
      return
    }
    if (!endpoint.isActive) {
      res.status(400).json({ success: false, error: { code: 'INACTIVE', message: 'Reative o endpoint antes de testar' } })
      return
    }

    // Escolhe um evento que o endpoint escuta — se ele aceita
    // lead.created, manda payload de exemplo desse tipo. Se não, usa
    // o primeiro evento configurado mesmo (com payload mínimo).
    const eventType = (endpoint.events.includes('lead.created')
      ? 'lead.created'
      : endpoint.events[0]) as WebhookEventType

    triggerWebhookEvent(tenantId, eventType, {
      test: true,
      message: 'Esse é um payload de teste disparado manualmente do TriboCRM',
      sample: {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Lead de Teste',
        email: 'teste@exemplo.com',
      },
    })

    res.json({ success: true, data: { message: 'Teste disparado. Veja a aba Logs em alguns segundos.' } })
  } catch (error: any) {
    console.error('[Webhooks] test error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao disparar teste' } })
  }
}

// ─── GET /webhooks/:id (com secret) ─────────────────────────────
//
// Retorna detalhes incluindo secret. Endpoint separado pra "revelar"
// o secret quando user clica "Mostrar secret" na UI. Apenas canManage.
export async function getWebhookSecret(req: Request, res: Response): Promise<void> {
  const { tenantId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem ver o secret' } })
    return
  }

  const id = req.params.id as string
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
      select: { id: true, secret: true },
    })
    if (!endpoint) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook não encontrado' } })
      return
    }
    res.json({ success: true, data: { secret: endpoint.secret } })
  } catch (error: any) {
    console.error('[Webhooks] getSecret error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar secret' } })
  }
}

// ─── GET /webhooks/:id/deliveries ───────────────────────────────
//
// Logs de entrega de UM endpoint. Paginado.
export async function listDeliveries(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId
  if (tenantId === 'platform') {
    res.json({ success: true, data: [], meta: { total: 0, limit: 0 } })
    return
  }

  const id = req.params.id as string
  const limitRaw = Number(req.query.limit ?? LOGS_DEFAULT_LIMIT)
  const limit = Math.min(LOGS_MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : LOGS_DEFAULT_LIMIT))

  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!endpoint) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook não encontrado' } })
      return
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        status: true,
        attemptCount: true,
        lastResponseStatus: true,
        lastResponseBody: true,
        lastError: true,
        nextRetryAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    })

    res.json({ success: true, data: deliveries, meta: { limit } })
  } catch (error: any) {
    console.error('[Webhooks] listDeliveries error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar logs' } })
  }
}

// ─── POST /webhooks/deliveries/:deliveryId/resend ───────────────
//
// Re-tenta uma delivery FAILED. Reseta attemptCount=0 — vai ter mais
// 3 tentativas a partir de agora.
export async function resendWebhookDelivery(req: Request, res: Response): Promise<void> {
  const { tenantId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem reenviar webhooks' } })
    return
  }

  const deliveryId = req.params.deliveryId as string
  try {
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, tenantId },
      select: { id: true },
    })
    if (!delivery) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Delivery não encontrada' } })
      return
    }

    await resendDelivery(deliveryId)
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error?.message ?? 'Erro ao reenviar' } })
  }
}
