import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { triggerWebhookEvent } from '../services/webhook-dispatcher.service'

// Controller da API pública v1. Toda rota aqui é montada DEPOIS do
// middleware apiKeyAuth, então sempre temos req.apiKey.tenantId. Não
// reusamos os controllers internos (zona protegida) — replicamos a
// lógica mínima necessária pros endpoints expostos. Isso isola a
// superfície pública do CRUD interno: bug em controller interno não
// afeta API, mudança breaking na API não afeta o CRM.
//
// Convenção de resposta: { success: true, data: ... } ou
// { success: false, error: { code, message } }, igual ao resto do app.

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return fallback
  const intN = Math.floor(n)
  if (max && intN > max) return max
  return intN
}

// Serializador comum de Lead pra API pública. Esconde campos internos
// (deletedAt, automationEvents, etc.) e converte Decimal pra number.
// Mantém o shape estável — adicionar campo aqui é zero-risco, remover
// é breaking change.
function serializeLead(lead: {
  id: string
  pipelineId: string
  stageId: string
  responsibleId: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  company: string | null
  source: string | null
  temperature: string
  expectedValue: Prisma.Decimal | null
  closedValue: Prisma.Decimal | null
  status: string
  wonAt: Date | null
  lostAt: Date | null
  lastActivityAt: Date | null
  createdAt: Date
  updatedAt: Date
  stage?: { id: string; name: string; type: string } | null
  pipeline?: { id: string; name: string } | null
  responsible?: { id: string; name: string } | null
}) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    company: lead.company,
    source: lead.source,
    temperature: lead.temperature,
    expectedValue: lead.expectedValue ? Number(lead.expectedValue) : null,
    closedValue: lead.closedValue ? Number(lead.closedValue) : null,
    status: lead.status,
    wonAt: lead.wonAt,
    lostAt: lead.lostAt,
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    pipelineId: lead.pipelineId,
    stageId: lead.stageId,
    responsibleId: lead.responsibleId,
    pipeline: lead.pipeline ?? null,
    stage: lead.stage ?? null,
    responsible: lead.responsible ?? null,
  }
}

// Round-robin / fallback de responsável quando body não traz responsibleId.
// Espelha o comportamento do form público: pula tenants sem nenhum user
// elegível com erro claro.
async function pickResponsible(
  tx: Prisma.TransactionClient,
  tenantId: string,
  pipelineId: string,
  distributionType: string,
  lastAssignedUserId: string | null,
): Promise<string | null> {
  const sellers = await tx.user.findMany({
    where: {
      tenantId,
      isActive: true,
      deletedAt: null,
      role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER'] },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  if (sellers.length === 0) return null
  const pool = sellers.map(s => s.id)

  if (distributionType === 'ROUND_ROBIN_ALL' && lastAssignedUserId) {
    const idx = pool.indexOf(lastAssignedUserId)
    const next = idx === -1 ? pool[0]! : pool[(idx + 1) % pool.length]!
    await tx.pipeline.update({ where: { id: pipelineId }, data: { lastAssignedUserId: next } }).catch(() => {})
    return next
  }

  const first = pool[0]!
  await tx.pipeline.update({ where: { id: pipelineId }, data: { lastAssignedUserId: first } }).catch(() => {})
  return first
}

// ─── POST /v1/leads ──────────────────────────────────────────────
//
// Body aceito (todos os campos opcionais marcados com `?`):
//   {
//     name: string,                    // obrigatório
//     email?: string,
//     phone?: string,
//     whatsapp?: string,
//     company?: string,
//     source?: string,                 // default: "API"
//     temperature?: "HOT"|"WARM"|"COLD",
//     expectedValue?: number,
//     pipelineId?: string,             // default: pipeline isDefault ou primeiro ativo
//     stageId?: string,                // default: primeiro stage do pipeline
//     responsibleId?: string,          // default: round-robin
//   }
//
// Retorna 201 com { data: <lead serializado> }.
export async function createLeadV1(req: Request, res: Response): Promise<void> {
  const tenantId = req.apiKey!.tenantId
  const body = (req.body ?? {}) as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' },
    })
    return
  }

  const email = typeof body.email === 'string' ? body.email.trim() || null : null
  const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null
  const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() || null : null
  const company = typeof body.company === 'string' ? body.company.trim() || null : null
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'API'

  const tempRaw = typeof body.temperature === 'string' ? body.temperature.toUpperCase() : null
  const temperature = (tempRaw === 'HOT' || tempRaw === 'WARM' || tempRaw === 'COLD') ? tempRaw : 'COLD'

  let expectedValue: number | null = null
  if (body.expectedValue !== undefined && body.expectedValue !== null) {
    const n = Number(body.expectedValue)
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'expectedValue inválido' },
      })
      return
    }
    expectedValue = n
  }

  const explicitPipelineId = typeof body.pipelineId === 'string' ? body.pipelineId : null
  const explicitStageId = typeof body.stageId === 'string' ? body.stageId : null
  const explicitResponsibleId = typeof body.responsibleId === 'string' ? body.responsibleId : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Pipeline: explícito (validar) ou default/primeiro ativo
      let pipeline: {
        id: string
        distributionType: string
        lastAssignedUserId: string | null
      } | null

      if (explicitPipelineId) {
        const p = await tx.pipeline.findFirst({
          where: { id: explicitPipelineId, tenantId, isActive: true },
          select: { id: true, distributionType: true, lastAssignedUserId: true },
        })
        if (!p) throw new Error('PIPELINE_NOT_FOUND')
        pipeline = p
      } else {
        pipeline = await tx.pipeline.findFirst({
          where: { tenantId, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, distributionType: true, lastAssignedUserId: true },
        })
        if (!pipeline) throw new Error('NO_PIPELINE_AVAILABLE')
      }

      // Stage: explícito (validar pertence ao pipeline) ou primeiro ativo
      let stageId: string
      if (explicitStageId) {
        const s = await tx.pipelineStage.findFirst({
          where: { id: explicitStageId, pipelineId: pipeline.id, tenantId, isActive: true },
          select: { id: true },
        })
        if (!s) throw new Error('STAGE_NOT_FOUND')
        stageId = s.id
      } else {
        const s = await tx.pipelineStage.findFirst({
          where: { pipelineId: pipeline.id, tenantId, isActive: true, type: 'NORMAL' },
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
        })
        if (!s) throw new Error('NO_STAGE_AVAILABLE')
        stageId = s.id
      }

      // Responsable: explícito (validar pertence ao tenant) ou round-robin
      let responsibleId: string
      if (explicitResponsibleId) {
        const u = await tx.user.findFirst({
          where: { id: explicitResponsibleId, tenantId, isActive: true, deletedAt: null },
          select: { id: true },
        })
        if (!u) throw new Error('RESPONSIBLE_NOT_FOUND')
        responsibleId = u.id
      } else {
        const picked = await pickResponsible(
          tx,
          tenantId,
          pipeline.id,
          pipeline.distributionType,
          pipeline.lastAssignedUserId,
        )
        if (!picked) throw new Error('NO_USER_AVAILABLE')
        responsibleId = picked
      }

      const lead = await tx.lead.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          stageId,
          responsibleId,
          createdBy: responsibleId,
          name,
          email,
          phone,
          whatsapp,
          company,
          source,
          temperature,
          expectedValue,
          lastActivityAt: new Date(),
        },
        include: {
          stage: { select: { id: true, name: true, type: true } },
          pipeline: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true } },
        },
      })

      return lead
    })

    // Dispara automation event LEAD_CREATED (não-bloqueante)
    prisma.automationEvent
      .create({
        data: {
          tenantId,
          triggerType: 'LEAD_CREATED',
          leadId: result.id,
          payload: { source: 'API', apiKeyId: req.apiKey!.apiKeyId },
        },
      })
      .catch((e) => console.error('[v1] LEAD_CREATED event error:', e?.message))

    // Webhook: lead.created (mesmo shape pra qualquer fonte de criação)
    triggerWebhookEvent(tenantId, 'lead.created', {
      lead: serializeLead(result),
    })

    res.status(201).json({ success: true, data: serializeLead(result) })
  } catch (error: any) {
    const code = error?.message
    if (code === 'PIPELINE_NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: 'PIPELINE_NOT_FOUND', message: 'Pipeline não encontrado' } })
      return
    }
    if (code === 'STAGE_NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: 'STAGE_NOT_FOUND', message: 'Etapa não encontrada nesse pipeline' } })
      return
    }
    if (code === 'RESPONSIBLE_NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: 'RESPONSIBLE_NOT_FOUND', message: 'Responsável não encontrado' } })
      return
    }
    if (code === 'NO_PIPELINE_AVAILABLE') {
      res.status(409).json({ success: false, error: { code: 'NO_PIPELINE_AVAILABLE', message: 'Tenant não possui pipeline ativo' } })
      return
    }
    if (code === 'NO_STAGE_AVAILABLE') {
      res.status(409).json({ success: false, error: { code: 'NO_STAGE_AVAILABLE', message: 'Pipeline não possui etapa ativa' } })
      return
    }
    if (code === 'NO_USER_AVAILABLE') {
      res.status(409).json({ success: false, error: { code: 'NO_USER_AVAILABLE', message: 'Tenant não possui usuário disponível' } })
      return
    }
    console.error('[v1] createLead error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar lead' } })
  }
}

// ─── GET /v1/leads ───────────────────────────────────────────────
//
// Query params:
//   status?: ACTIVE|WON|LOST|ARCHIVED
//   pipelineId?, stageId?, responsibleId?
//   page=1 (default), limit=50 (default, max 100)
//   sort=createdAt|updatedAt|lastActivityAt (default: createdAt)
//   order=asc|desc (default: desc)
//
// Retorna { data: [...], meta: { total, page, limit, totalPages } }
export async function listLeadsV1(req: Request, res: Response): Promise<void> {
  const tenantId = req.apiKey!.tenantId

  const page = parsePositiveInt(req.query.page, 1)
  const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT)
  const skip = (page - 1) * limit

  const where: Prisma.LeadWhereInput = { tenantId, deletedAt: null }

  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null
  if (status === 'ACTIVE' || status === 'WON' || status === 'LOST' || status === 'ARCHIVED') {
    where.status = status
  }

  const pipelineId = typeof req.query.pipelineId === 'string' ? req.query.pipelineId : null
  if (pipelineId) where.pipelineId = pipelineId

  const stageId = typeof req.query.stageId === 'string' ? req.query.stageId : null
  if (stageId) where.stageId = stageId

  const responsibleId = typeof req.query.responsibleId === 'string' ? req.query.responsibleId : null
  if (responsibleId) where.responsibleId = responsibleId

  const sortRaw = typeof req.query.sort === 'string' ? req.query.sort : 'createdAt'
  const sort = (['createdAt', 'updatedAt', 'lastActivityAt'].includes(sortRaw) ? sortRaw : 'createdAt') as
    'createdAt' | 'updatedAt' | 'lastActivityAt'
  const order = req.query.order === 'asc' ? 'asc' : 'desc'

  try {
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy: { [sort]: order },
        skip,
        take: limit,
        include: {
          stage: { select: { id: true, name: true, type: true } },
          pipeline: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true } },
        },
      }),
    ])

    res.json({
      success: true,
      data: leads.map(serializeLead),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('[v1] listLeads error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar leads' } })
  }
}

// ─── GET /v1/leads/:id ───────────────────────────────────────────
export async function getLeadV1(req: Request, res: Response): Promise<void> {
  const tenantId = req.apiKey!.tenantId
  const id = req.params.id as string

  try {
    const lead = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        stage: { select: { id: true, name: true, type: true } },
        pipeline: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }

    res.json({ success: true, data: serializeLead(lead) })
  } catch (error: any) {
    console.error('[v1] getLead error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar lead' } })
  }
}

// ─── GET /v1/pipelines ───────────────────────────────────────────
//
// Lista pipelines ativos do tenant + stages embedded. Útil pra cliente
// descobrir IDs antes de POST /leads com pipelineId/stageId explícitos.
export async function listPipelinesV1(req: Request, res: Response): Promise<void> {
  const tenantId = req.apiKey!.tenantId

  try {
    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        stages: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, type: true, sortOrder: true, color: true },
        },
      },
    })

    res.json({ success: true, data: pipelines })
  } catch (error: any) {
    console.error('[v1] listPipelines error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar pipelines' } })
  }
}

// ─── GET /v1/tasks ───────────────────────────────────────────────
//
// Query params:
//   responsibleId?, leadId?, isDone? (true/false)
//   dueBefore? (ISO date), dueAfter? (ISO date)
//   page, limit (mesmos defaults de leads)
export async function listTasksV1(req: Request, res: Response): Promise<void> {
  const tenantId = req.apiKey!.tenantId

  const page = parsePositiveInt(req.query.page, 1)
  const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT)
  const skip = (page - 1) * limit

  const where: Prisma.TaskWhereInput = { tenantId }

  const responsibleId = typeof req.query.responsibleId === 'string' ? req.query.responsibleId : null
  if (responsibleId) where.responsibleId = responsibleId

  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : null
  if (leadId) where.leadId = leadId

  if (req.query.isDone === 'true') where.isDone = true
  else if (req.query.isDone === 'false') where.isDone = false

  const dueBefore = typeof req.query.dueBefore === 'string' ? new Date(req.query.dueBefore) : null
  const dueAfter = typeof req.query.dueAfter === 'string' ? new Date(req.query.dueAfter) : null
  if (dueBefore && !isNaN(dueBefore.getTime())) where.dueDate = { ...(where.dueDate as any ?? {}), lte: dueBefore }
  if (dueAfter && !isNaN(dueAfter.getTime())) where.dueDate = { ...(where.dueDate as any ?? {}), gte: dueAfter }

  try {
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
        include: {
          lead: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true } },
        },
      }),
    ])

    const data = tasks.map(t => ({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      isDone: t.isDone,
      doneAt: t.doneAt,
      leadId: t.leadId,
      responsibleId: t.responsibleId,
      lead: t.lead,
      responsible: t.responsible,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))

    res.json({
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error: any) {
    console.error('[v1] listTasks error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar tarefas' } })
  }
}
