import { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTenantId } from '../lib/platformTenant'
import { userHasPipelineAccess } from './pipeline.controller'
import { sendPushToUser } from '../services/push-notification.service'

// ── Helpers for import ──

const HEADER_MAP: Record<string, string> = {
  'nome': 'name',
  'empresa': 'company',
  'e-mail': 'email',
  'email': 'email',
  'telefone': 'phone',
  'whatsapp': 'whatsapp',
  'cpf': 'cpf',
  'cnpj': 'cnpj',
  'cargo': 'position',
  'origem': 'source',
  'fonte': 'source',
  'temperatura': 'temperature',
  'valor esperado': 'expectedValue',
  'valor': 'expectedValue',
  'observacoes': 'notes',
  'observações': 'notes',
}

function normalizeKey(s: string): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizePhone(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/\D/g, '')
}

function normalizeEmail(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).trim().toLowerCase()
}

function parseTemperature(v: unknown): 'HOT' | 'WARM' | 'COLD' | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (['hot', 'quente', 'q'].includes(s)) return 'HOT'
  if (['warm', 'morno', 'm'].includes(s)) return 'WARM'
  if (['cold', 'frio', 'f'].includes(s)) return 'COLD'
  return null
}

function parseDecimal(v: unknown): Prisma.Decimal | null {
  if (v == null || v === '') return null
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(',', '.'))
  if (isNaN(num)) return null
  return new Prisma.Decimal(num)
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: string }).text ?? '')
  if (typeof v === 'object' && 'richText' in (v as object)) return ((v as { richText: { text: string }[] }).richText ?? []).map(r => r.text).join('')
  return String(v)
}

// Restringe acesso a leads pra role SELLER (isolamento entre vendedores).
// Non-SELLER roles (OWNER/MANAGER/TEAM_LEADER/SUPER_ADMIN) veem tudo do tenant.
// Spread no where do Prisma: { tenantId, ...sellerScope(role, userId) }.
export function sellerScope(role: string, userId: string): { responsibleId?: string } {
  return role === 'SELLER' ? { responsibleId: userId } : {}
}

// Lookup reverso: dado um telefone, retorna o leadId do lead que tem
// esse telefone na lista de alt-phones (campo Lead.altPhones, JSON array).
// Respeita tenant scope e sellerScope. Retorna null se não encontrar.
//
// Função extraída do handler GET /leads/by-alt-phone/:phone pra permitir
// teste unitário com Prisma mockado (supertest não está disponível).
export async function findLeadByAltPhone(
  prismaClient: typeof prisma,
  tenantId: string,
  phone: string,
  role: string,
  userId: string,
): Promise<{ leadId: string } | null> {
  const lead = await prismaClient.lead.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      altPhones: { array_contains: phone },
      ...sellerScope(role, userId),
    },
    select: { id: true },
  })
  return lead ? { leadId: lead.id } : null
}

// Gera variações de um telefone brasileiro pra busca tolerante.
// O nono dígito do celular foi adicionado em 2012; usuários antigos
// ainda guardam contatos sem ele. Esta função retorna todas as formas
// equivalentes do mesmo número pra que a query bata independente de
// como o vendedor digitou.
//
// Entrada: qualquer formato com dígitos ("+55 33 99931-7423", "33999317423", etc.)
// Saída: lista única de variações (sem prefixo '+'), por exemplo:
//   "33999317423"  → ["33999317423", "3399317423", "5533999317423", "553399317423"]
//   "5533999317423" → ["33999317423", "3399317423", "5533999317423", "553399317423"]
export function generatePhoneVariations(input: string): string[] {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length < 10) return digits ? [digits] : []

  // Remove DDI 55 se presente (precisa ter 12-13 dígitos pra evitar
  // confundir com fixo+DDD que começa por 55, ex.: 5511 4xxx-xxxx).
  let local = digits
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    local = digits.slice(2)
  }

  const variations = new Set<string>()
  variations.add(local)

  // Celular com nono dígito (DDD + 9 + 8 dígitos = 11) → variação sem o 9
  if (local.length === 11 && local[2] === '9') {
    variations.add(local.slice(0, 2) + local.slice(3))
  }

  // Telefone de 10 dígitos (DDD + 8 dígitos) → variação com 9 inserido
  // entre DDD e o resto (caso seja celular antigo). Pra fixo gera um
  // número que não existe — sem falso positivo desde que ninguém
  // tenha esse número fictício cadastrado.
  if (local.length === 10) {
    variations.add(local.slice(0, 2) + '9' + local.slice(2))
  }

  // Adiciona prefixo 55 em cada variação local
  const withCountryCode = Array.from(variations).map(v => '55' + v)
  withCountryCode.forEach(v => variations.add(v))

  return Array.from(variations)
}

// Busca um lead pelo telefone aplicando variações brasileiras (com/sem
// nono dígito, com/sem DDI 55) em phone, whatsapp e altPhones.
// Retorna o primeiro match. Respeita tenant + sellerScope.
//
// Por que SQL raw em vez de Prisma where?
//   Os campos phone/whatsapp são salvos com máscara ("(33) 99931-7423")
//   pelo formulário do frontend. Comparação exata ou contains não bate
//   com variações em dígitos puros. regexp_replace no Postgres remove
//   tudo que não é dígito antes de comparar — robusto a qualquer máscara.
//
// Função extraída pra permitir teste unitário com Prisma mockado.
export async function findLeadByPhone(
  prismaClient: typeof prisma,
  tenantId: string,
  phone: string,
  role: string,
  userId: string,
): Promise<{ id: string } | null> {
  const variations = generatePhoneVariations(phone)
  if (variations.length === 0) return null

  const sellerFilter = role === 'SELLER'
    ? Prisma.sql`AND responsible_id = ${userId}::uuid`
    : Prisma.empty

  // Filtro de pipeline access: OWNER/SUPER_ADMIN passam direto;
  // demais roles so podem ver leads de pipelines que tem acesso
  // (linha em user_pipeline_access).
  const pipelineAccessFilter = (role === 'OWNER' || role === 'SUPER_ADMIN')
    ? Prisma.empty
    : Prisma.sql`AND pipeline_id IN (
        SELECT pipeline_id FROM user_pipeline_access WHERE user_id = ${userId}::uuid
      )`

  // Query raw: normaliza phone/whatsapp do DB pra dígitos puros e
  // compara com qualquer variação. altPhones já é guardado em dígitos
  // puros pela extensão, mas regexp_replace cobre casos legados.
  //
  // ATENCAO: nomes de tabela e coluna sao do Postgres (snake_case
  // segundo @@map e @map do schema.prisma), nao os do model Prisma.
  // tenantId/userId/leadId sao UUID no schema → cast explicito ::uuid
  // pra evitar erro de tipo em parametros bindados como text.
  // alt_phones ja e jsonb (migration 20260428010000_add_lead_alt_phones).
  const variationsList = Prisma.join(variations)
  const query = Prisma.sql`
    SELECT id FROM leads
    WHERE tenant_id = ${tenantId}::uuid
      AND deleted_at IS NULL
      ${sellerFilter}
      ${pipelineAccessFilter}
      AND (
        regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') IN (${variationsList})
        OR regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g') IN (${variationsList})
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(alt_phones, '[]'::jsonb)) AS p
          WHERE regexp_replace(p, '[^0-9]', '', 'g') IN (${variationsList})
        )
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `
  const rows = await prismaClient.$queryRaw<{ id: string }[]>(query)

  if (rows.length === 0) return null
  return { id: rows[0]!.id }
}

export async function getLossReasons(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const reasons = await prisma.lossReason.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    })
    res.json({ success: true, data: reasons })
  } catch (error) {
    console.error('[Leads] getLossReasons error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } })
  }
}

export async function getLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = await resolveTenantId(req.user!.tenantId)
    const role = req.user!.role
    const userId = req.user!.userId

    const {
      pipelineId,
      stageId,
      status,
      temperature,
      responsibleId,
      search,
      page = '1',
      perPage = '20',
    } = req.query as Record<string, string | undefined>

    const pageNum = Math.max(1, parseInt(page ?? '1'))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage ?? '20')))

    const where: Prisma.LeadWhereInput = {
      tenantId,
      deletedAt: null,
    }

    if (status && status !== '') where.status = status as 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'
    if (pipelineId) where.pipelineId = pipelineId
    if (stageId) where.stageId = stageId
    if (temperature) where.temperature = temperature as 'HOT' | 'WARM' | 'COLD'

    if (role === 'SELLER') {
      where.responsibleId = userId
    } else if (responsibleId) {
      where.responsibleId = responsibleId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search, mode: 'insensitive' } },
      ]
    }

    console.log('[Leads] getLeads query:', JSON.stringify({ tenantId, role, userId, where: JSON.stringify(where).slice(0, 500) }))

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          stage: { select: { id: true, name: true, color: true } },
          responsible: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (pageNum - 1) * perPageNum,
        take: perPageNum,
      }),
      prisma.lead.count({ where }),
    ])

    res.json({
      success: true,
      data: leads,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
      },
    })
  } catch (error) {
    console.error('[Leads] getLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getLead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const lead = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      include: {
        stage: { select: { id: true, name: true, color: true, type: true } },
        responsible: { select: { id: true, name: true } },
        // pipeline e obrigatorio pra extensao Chrome — o painel acessa
        // lead.pipeline.id (Marcar Venda/Perda) e lead.pipeline.name
        // (aba Dados). Sem isso o Preact crasha em runtime com
        // "Cannot read properties of undefined (reading 'name')",
        // travando a UI inteira (setState posteriores nao pintam).
        pipeline: { select: { id: true, name: true } },
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        tasks: {
          where: { isDone: false },
        },
      },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    // Mirror interaction.content → description so clients reading either
    // key (the UI reads content; API inspectors sometimes look for
    // description) see the same value.
    const enriched = {
      ...lead,
      interactions: (lead.interactions as Array<Record<string, unknown>>).map(i => ({ ...i, description: i.content })),
    }
    res.json({ success: true, data: enriched })
  } catch (error) {
    console.error('[Leads] getLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

/**
 * Resolve the responsible user for a new lead based on the pipeline's
 * configured distribution rule.
 *
 * - MANUAL          → bodyResponsibleId (or fall back to current user)
 * - SPECIFIC_USER   → pipeline.specificUserId (fall back to MANUAL if missing)
 * - ROUND_ROBIN_ALL → next active SELLER/TEAM_LEADER/MANAGER after lastAssignedUserId
 * - ROUND_ROBIN_TEAM→ next active member of pipeline.teamId after lastAssignedUserId
 *
 * Returns { responsibleId, teamId, nextLastAssigned } so the caller can both
 * insert the lead and update pipeline.lastAssignedUserId atomically.
 */
async function resolveResponsibleForPipeline(
  tx: Prisma.TransactionClient,
  pipeline: { id: string; distributionType: string; lastAssignedUserId: string | null; teamId: string | null; specificUserId: string | null },
  tenantId: string,
  currentUserId: string,
  bodyResponsibleId: string | undefined,
): Promise<{ responsibleId: string; teamId: string | null }> {
  const dt = pipeline.distributionType

  // Helper: rotate to the next id in a sorted pool, given the last assigned
  function nextInPool(pool: string[], last: string | null): string {
    if (pool.length === 0) throw new Error('Pool de vendedores vazio')
    if (!last) return pool[0]!
    const idx = pool.indexOf(last)
    if (idx === -1) return pool[0]!
    return pool[(idx + 1) % pool.length]!
  }

  if (dt === 'SPECIFIC_USER' && pipeline.specificUserId) {
    return { responsibleId: pipeline.specificUserId, teamId: null }
  }

  if (dt === 'ROUND_ROBIN_ALL') {
    const sellers = await tx.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        userStatus: 'ACTIVE',
        role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER'] },
      },
      select: { id: true },
      orderBy: { name: 'asc' },
    })
    if (sellers.length > 0) {
      const pool = sellers.map(s => s.id)
      return { responsibleId: nextInPool(pool, pipeline.lastAssignedUserId), teamId: null }
    }
    // Fall through to MANUAL on empty pool
  }

  if (dt === 'ROUND_ROBIN_TEAM' && pipeline.teamId) {
    const members = await tx.teamMember.findMany({
      where: {
        teamId: pipeline.teamId,
        tenantId,
        user: { isActive: true, userStatus: 'ACTIVE', deletedAt: null },
      },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    })
    if (members.length > 0) {
      const pool = members.map(m => m.userId)
      return { responsibleId: nextInPool(pool, pipeline.lastAssignedUserId), teamId: pipeline.teamId }
    }
    // Fall through to MANUAL on empty team
  }

  // MANUAL (or any unconfigured branch above): use what the body provided,
  // validating it belongs to the tenant; otherwise the current user.
  if (bodyResponsibleId && bodyResponsibleId !== '') {
    const respUser = await tx.user.findFirst({
      where: { id: bodyResponsibleId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (respUser) return { responsibleId: respUser.id, teamId: null }
  }
  return { responsibleId: currentUserId, teamId: null }
}

export async function createLead(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const role = req.user!.role

    const { name, company, email, phone, whatsapp, expectedValue, stageId, pipelineId, responsibleId, temperature = 'WARM' } = req.body

    if (!name || !stageId || !pipelineId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nome, stageId e pipelineId são obrigatórios' },
      })
      return
    }

    // Valida acesso a pipeline. OWNER/SUPER_ADMIN passam direto;
    // demais roles precisam ter linha em user_pipeline_access.
    const hasAccess = await userHasPipelineAccess(prisma, userId, role, pipelineId, tenantId)
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: { code: 'PIPELINE_ACCESS_DENIED', message: 'Você não tem acesso a este pipeline' },
      })
      return
    }

    // SELLER não pode escolher outro responsável via body — ignora
    // qualquer responsibleId enviado e força para o próprio usuário.
    // Pipelines ROUND_ROBIN_* continuam decidindo normalmente no resolve
    // (é escolha de config do pipeline, não privilégio do caller).
    const effectiveResponsibleId = role === 'SELLER' ? userId : responsibleId

    const result = await prisma.$transaction(async (tx) => {
      const pipeline = await tx.pipeline.findFirst({
        where: { id: pipelineId, tenantId },
        select: { id: true, distributionType: true, lastAssignedUserId: true, teamId: true, specificUserId: true },
      })
      if (!pipeline) throw new Error('PIPELINE_NOT_FOUND')

      const stage = await tx.pipelineStage.findFirst({
        where: { id: stageId, tenantId, pipelineId },
        select: { id: true },
      })
      if (!stage) throw new Error('STAGE_NOT_FOUND')

      const { responsibleId: assignedId, teamId: assignedTeamId } =
        await resolveResponsibleForPipeline(tx, pipeline, tenantId, userId, effectiveResponsibleId)

      const lead = await tx.lead.create({
        data: {
          tenantId,
          pipelineId,
          stageId,
          responsibleId: assignedId,
          teamId: assignedTeamId,
          createdBy: userId,
          name,
          company: company || null,
          email: email || null,
          phone: phone || null,
          whatsapp: whatsapp || null,
          expectedValue: expectedValue ? new Prisma.Decimal(expectedValue) : null,
          temperature,
          status: 'ACTIVE',
        },
        include: {
          stage: { select: { id: true, name: true, color: true } },
          responsible: { select: { id: true, name: true } },
        },
      })

      // Persist the rotation cursor for round-robin so the next manual
      // create picks the next user in the sequence.
      if (pipeline.distributionType === 'ROUND_ROBIN_ALL' || pipeline.distributionType === 'ROUND_ROBIN_TEAM') {
        await tx.pipeline.update({
          where: { id: pipelineId },
          data: { lastAssignedUserId: assignedId },
        })
      }

      return lead
    })

    res.status(201).json({ success: true, data: result })

    // Fire automation event (non-blocking)
    prisma.automationEvent.create({
      data: { tenantId, triggerType: 'LEAD_CREATED', leadId: result.id, payload: {} },
    }).catch(e => console.error('[Leads] automation event error:', e?.message))

    // Push pro vendedor responsável (se tiver e for diferente do criador
    // — quem criou o lead obviamente já sabe)
    if (result.responsibleId && result.responsibleId !== userId) {
      sendPushToUser(result.responsibleId, {
        title: '🎯 Novo lead atribuído',
        body: `${result.name}${result.company ? ` (${result.company})` : ''} — atendê-lo logo aumenta a chance de fechar.`,
        url: `/vendas/leads/${result.id}`,
        tag: `lead-${result.id}`,
      }).catch(() => {}) // best-effort, já é fire-and-forget no service
    }
  } catch (error: any) {
    if (error?.message === 'PIPELINE_NOT_FOUND') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Pipeline não encontrado' } })
      return
    }
    if (error?.message === 'STAGE_NOT_FOUND') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Etapa não encontrada neste pipeline' } })
      return
    }
    console.error('[Leads] createLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateLead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const existing = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null, ...sellerScope(role, userId) },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    const {
      name, company, email, phone, whatsapp, expectedValue, stageId, temperature,
      status, notes, responsibleId, cpf, cnpj, position, source,
      lossReasonId, closedValue, wonAt, lostAt,
    } = req.body

    const data: Prisma.LeadUpdateInput = {}
    if (name !== undefined) data.name = name
    if (company !== undefined) data.company = company
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (whatsapp !== undefined) data.whatsapp = whatsapp
    if (cpf !== undefined) data.cpf = cpf || null
    if (cnpj !== undefined) data.cnpj = cnpj || null
    if (position !== undefined) data.position = position || null
    if (source !== undefined) data.source = source || null
    if (expectedValue !== undefined) data.expectedValue = expectedValue ? new Prisma.Decimal(expectedValue) : null
    if (stageId !== undefined) data.stage = { connect: { id: stageId } }
    if (temperature !== undefined) data.temperature = temperature
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes

    // Quando o cliente muda stageId mas NAO informa status explicito,
    // derivamos status do stage.type pra manter o kanban consistente:
    //   - stage.type WON  → status='WON'  (lead aparece na coluna Finalizado)
    //   - stage.type LOST → status='LOST' (lead aparece na coluna Perdido)
    //   - demais          → status='ACTIVE'
    // Sem isso, leads movidos pra coluna WON/LOST via API que nao manda
    // status (ex: extensao Chrome usando outcome.service) somem do kanban
    // porque o filtro do getKanban e por status, nao por stage.type.
    if (stageId !== undefined && status === undefined) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: stageId, tenantId },
        select: { type: true },
      })
      if (stage) {
        data.status = stage.type === 'WON' ? 'WON' : stage.type === 'LOST' ? 'LOST' : 'ACTIVE'
      }
    }
    if (responsibleId !== undefined) data.responsible = { connect: { id: responsibleId } }
    if (lossReasonId !== undefined) data.lossReasonId = lossReasonId || null
    if (closedValue !== undefined) {
      try {
        data.closedValue = closedValue ? new Prisma.Decimal(String(closedValue)) : null
      } catch (e) {
        console.error('[Leads] closedValue conversion failed:', closedValue, e)
        data.closedValue = null
      }
    }
    if (wonAt !== undefined) {
      try {
        data.wonAt = wonAt ? new Date(wonAt) : null
        if (data.wonAt && isNaN(data.wonAt.getTime())) {
          console.error('[Leads] wonAt invalid date:', wonAt)
          data.wonAt = null
        }
      } catch (e) {
        console.error('[Leads] wonAt conversion failed:', wonAt, e)
        data.wonAt = null
      }
    }
    if (lostAt !== undefined) data.lostAt = lostAt ? new Date(lostAt) : null

    const lead = await prisma.lead.update({
      where: { id },
      data,
      include: {
        stage: { select: { id: true, name: true, color: true } },
        responsible: { select: { id: true, name: true } },
      },
    })

    // ── Histórico de alterações (Interaction SYSTEM, isAuto=true) ──
    // Cria entradas no histórico do lead pros campos importantes que
    // mudaram. Aparece automaticamente na aba "Histórico" da drawer
    // (que já renderiza interactions). Falha aqui não rola back na
    // mudança principal — best-effort.
    try {
      const changes: { content: string }[] = []
      const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })

      // Mudança de etapa
      if (stageId !== undefined && stageId !== existing.stageId) {
        const [oldStage, newStage] = await Promise.all([
          prisma.pipelineStage.findUnique({ where: { id: existing.stageId }, select: { name: true } }),
          prisma.pipelineStage.findUnique({ where: { id: stageId }, select: { name: true } }),
        ])
        changes.push({ content: `Movido de "${oldStage?.name ?? '?'}" para "${newStage?.name ?? '?'}"` })
      }

      // Mudança de responsável
      if (responsibleId !== undefined && responsibleId !== existing.responsibleId) {
        const [oldUser, newUser] = await Promise.all([
          prisma.user.findUnique({ where: { id: existing.responsibleId }, select: { name: true } }),
          prisma.user.findUnique({ where: { id: responsibleId }, select: { name: true } }),
        ])
        changes.push({ content: `Responsável alterado de ${oldUser?.name ?? '?'} para ${newUser?.name ?? '?'}` })
      }

      // Mudança de valor esperado
      if (expectedValue !== undefined) {
        const oldVal = existing.expectedValue ? Number(existing.expectedValue) : 0
        const newVal = expectedValue ? Number(expectedValue) : 0
        if (oldVal !== newVal) {
          changes.push({ content: `Valor esperado alterado de ${fmtBRL(oldVal)} para ${fmtBRL(newVal)}` })
        }
      }

      // Status virou WON (registro adicional ao stage change — explícito sobre venda)
      if (status === 'WON' && existing.status !== 'WON') {
        const cv = closedValue ? Number(closedValue) : (existing.closedValue ? Number(existing.closedValue) : 0)
        changes.push({ content: `Venda registrada — valor ${fmtBRL(cv)}` })
      }

      // Status virou LOST com motivo
      if (status === 'LOST' && existing.status !== 'LOST') {
        let reasonSuffix = ''
        if (lossReasonId) {
          const lr = await prisma.lossReason.findUnique({ where: { id: lossReasonId }, select: { name: true } })
          reasonSuffix = lr ? ` — motivo: ${lr.name}` : ''
        }
        changes.push({ content: `Lead marcado como perdido${reasonSuffix}` })
      }

      // Mudança de temperatura
      if (temperature !== undefined && temperature !== existing.temperature) {
        const tempLabels: Record<string, string> = { HOT: 'Quente', WARM: 'Morno', COLD: 'Frio' }
        changes.push({
          content: `Temperatura alterada de ${tempLabels[existing.temperature] ?? existing.temperature} para ${tempLabels[temperature] ?? temperature}`,
        })
      }

      if (changes.length > 0) {
        await prisma.interaction.createMany({
          data: changes.map(c => ({
            tenantId,
            leadId: id,
            userId, // quem fez a alteração (req.user.userId)
            type: 'SYSTEM' as const,
            content: c.content,
            isAuto: true,
          })),
        })
      }
    } catch (histErr) {
      console.error('[Leads] history hook failed (non-blocking):', histErr)
    }

    // Push pro novo responsável quando vendedor é REATRIBUÍDO. Só envia
    // se o novo responsável é diferente de quem fez a alteração.
    if (responsibleId !== undefined && responsibleId !== existing.responsibleId && responsibleId !== userId) {
      sendPushToUser(responsibleId, {
        title: '🎯 Lead atribuído a você',
        body: `${lead.name}${lead.company ? ` (${lead.company})` : ''} foi transferido pra você.`,
        url: `/vendas/leads/${id}`,
        tag: `lead-${id}`,
      }).catch(() => {})
    }

    // Fire STAGE_CHANGED automation event (non-blocking)
    if (stageId !== undefined && stageId !== existing.stageId) {
      prisma.automationEvent.create({
        data: { tenantId, triggerType: 'STAGE_CHANGED', leadId: id, payload: { stageId, previousStageId: existing.stageId } },
      }).catch(e => console.error('[Leads] automation event error:', e?.message))
    }

    // Detect repeat purchase: if the lead is being moved to WON and
    // it had a previous wonAt (meaning it was won before), this is a
    // returning customer. Notify the seller and log it.
    if (status === 'WON' && existing.wonAt !== null) {
      try {
        await prisma.notification.create({
          data: {
            tenantId,
            userId: existing.responsibleId,
            type: 'EMAIL_OPENED', // Closest generic type; REPEAT_PURCHASE is an AutomationTrigger, not NotificationType
            title: 'Cliente recorrente!',
            body: `${existing.name} comprou novamente! Cliente recorrente.`,
            link: `/vendas/leads/${id}`,
          },
        })

        // Log in interaction history
        await prisma.interaction.create({
          data: {
            tenantId,
            leadId: id,
            userId: existing.responsibleId,
            type: 'SYSTEM',
            content: `Compra recorrente registrada. Lead ${existing.name} fechou novamente.`,
            isAuto: true,
          },
        })
      } catch (notifErr) {
        console.error('[Leads] repeat purchase notification failed:', notifErr)
      }
    }

    // Append a persistent LeadPurchase row whenever this update is
    // flipping the lead to WON with a concrete closedValue + wonAt.
    // The existing lead row still carries the latest sale inline;
    // this gives the drawer a full history to iterate over without
    // losing older sales when a lead is re-won.
    if (status === 'WON' && closedValue != null && wonAt) {
      try {
        const parsedValue = new Prisma.Decimal(String(closedValue))
        const parsedWonAt = new Date(wonAt)
        if (!Number.isNaN(parsedWonAt.getTime())) {
          await prisma.leadPurchase.create({
            data: {
              tenantId,
              leadId: id,
              closedValue: parsedValue,
              wonAt: parsedWonAt,
              productName: null,
              closedBy: req.user!.userId,
            },
          })
        }
      } catch (purchaseErr) {
        // Non-fatal — the lead update already succeeded, and the
        // history row is a nice-to-have for the drawer. Log and move on.
        console.error('[Leads] leadPurchase create failed:', purchaseErr)
      }
    }

    res.json({ success: true, data: lead })
  } catch (error) {
    console.error('[Leads] updateLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteLead(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const existing = await prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null, ...sellerScope(role, userId) },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Leads] deleteLead error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Bulk Update Leads ──

type BulkAction = 'change_responsible' | 'change_stage' | 'change_temperature' | 'redistribute' | 'delete'

export async function bulkUpdateLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const role = req.user!.role

    // Ações em massa são de gestão — SELLER não pode rodar bulk, nem
    // sobre próprios leads. Operações individuais (PATCH /leads/:id)
    // continuam disponíveis e aplicam sellerScope automaticamente.
    if (role === 'SELLER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Ações em massa não disponíveis para vendedores' },
      })
      return
    }

    const { leadIds, action, payload } = req.body as {
      leadIds: string[]
      action: BulkAction
      payload?: Record<string, unknown>
    }

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'leadIds obrigatório e não pode ser vazio' } })
      return
    }
    if (!action) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'action obrigatória' } })
      return
    }

    // Verify all leads belong to the tenant
    const leadCount = await prisma.lead.count({
      where: { id: { in: leadIds }, tenantId, deletedAt: null },
    })
    if (leadCount !== leadIds.length) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Um ou mais leads não foram encontrados neste tenant' } })
      return
    }

    const whereIds = { id: { in: leadIds }, tenantId, deletedAt: null }

    if (action === 'change_responsible') {
      const newResponsibleId = String(payload?.responsibleId ?? '')
      if (!newResponsibleId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'responsibleId obrigatório' } })
        return
      }
      const user = await prisma.user.findFirst({ where: { id: newResponsibleId, tenantId, deletedAt: null }, select: { id: true } })
      if (!user) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Responsável não encontrado' } })
        return
      }
      const result = await prisma.lead.updateMany({ where: whereIds, data: { responsibleId: newResponsibleId } })
      res.json({ success: true, data: { updated: result.count } })
      return
    }

    if (action === 'change_stage') {
      const newStageId = String(payload?.stageId ?? '')
      if (!newStageId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'stageId obrigatório' } })
        return
      }
      const stage = await prisma.pipelineStage.findFirst({ where: { id: newStageId, tenantId }, select: { id: true } })
      if (!stage) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Etapa não encontrada' } })
        return
      }
      const result = await prisma.lead.updateMany({ where: whereIds, data: { stageId: newStageId } })
      res.json({ success: true, data: { updated: result.count } })

      // Fire STAGE_CHANGED events for each lead (non-blocking)
      for (const lid of leadIds) {
        prisma.automationEvent.create({
          data: { tenantId, triggerType: 'STAGE_CHANGED', leadId: lid, payload: { stageId: newStageId } },
        }).catch(() => {})
      }
      return
    }

    if (action === 'change_temperature') {
      const newTemp = String(payload?.temperature ?? '')
      if (!['HOT', 'WARM', 'COLD'].includes(newTemp)) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'temperature deve ser HOT, WARM ou COLD' } })
        return
      }
      const result = await prisma.lead.updateMany({ where: whereIds, data: { temperature: newTemp as 'HOT' | 'WARM' | 'COLD' } })
      res.json({ success: true, data: { updated: result.count } })
      return
    }

    if (action === 'redistribute') {
      const distType = String(payload?.distributionType ?? 'ROUND_ROBIN_ALL')
      let pool: string[] = []

      if (distType === 'SPECIFIC_USER') {
        const uid = String(payload?.responsibleId ?? '')
        if (!uid) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'responsibleId obrigatório' } }); return }
        pool = [uid]
      } else if (distType === 'ROUND_ROBIN_TEAM') {
        const tid = String(payload?.teamId ?? '')
        if (!tid) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'teamId obrigatório' } }); return }
        const members = await prisma.teamMember.findMany({
          where: { teamId: tid, tenantId, user: { isActive: true, userStatus: 'ACTIVE', deletedAt: null } },
          select: { userId: true },
          orderBy: { joinedAt: 'asc' },
        })
        pool = members.map(m => m.userId)
      } else {
        // ROUND_ROBIN_ALL
        const sellers = await prisma.user.findMany({
          where: { tenantId, deletedAt: null, isActive: true, userStatus: 'ACTIVE', role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER'] } },
          select: { id: true },
          orderBy: { name: 'asc' },
        })
        pool = sellers.map(s => s.id)
      }

      if (pool.length === 0) {
        res.status(400).json({ success: false, error: { code: 'NO_SELLERS', message: 'Nenhum vendedor disponível para redistribuição' } })
        return
      }

      // Update each lead individually for round-robin
      let updated = 0
      for (let i = 0; i < leadIds.length; i++) {
        await prisma.lead.update({
          where: { id: leadIds[i] },
          data: { responsibleId: pool[i % pool.length]! },
        })
        updated++
      }
      res.json({ success: true, data: { updated } })
      return
    }

    if (action === 'delete') {
      const result = await prisma.lead.updateMany({
        where: whereIds,
        data: { deletedAt: new Date() },
      })
      res.json({ success: true, data: { updated: result.count } })
      return
    }

    res.status(400).json({ success: false, error: { code: 'UNKNOWN_ACTION', message: `Ação '${action}' não reconhecida` } })
  } catch (error: any) {
    console.error('[Leads] bulkUpdateLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: error?.code ?? 'INTERNAL_ERROR', message: error?.message ?? 'Erro ao executar ação em lote' },
    })
  }
}

// ── Import Leads from XLSX ──

interface ImportRow {
  name: string
  company: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  cpf: string | null
  cnpj: string | null
  position: string | null
  source: string | null
  temperature: 'HOT' | 'WARM' | 'COLD' | null
  expectedValue: Prisma.Decimal | null
  notes: string | null
}

export async function importLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId

    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'Nenhum arquivo enviado' } })
      return
    }

    const {
      pipelineId, stageId, responsibleId, teamId,
      distributionType = 'SPECIFIC_USER',
    } = req.body as Record<string, string | undefined>

    if (!pipelineId || !stageId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'pipelineId e stageId são obrigatórios' },
      })
      return
    }

    if (!['ROUND_ROBIN_ALL', 'ROUND_ROBIN_TEAM', 'SPECIFIC_USER'].includes(distributionType)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'distributionType inválido' },
      })
      return
    }

    // Validate pipeline + stage belong to tenant
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, tenantId },
    })
    if (!stage) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Etapa não encontrada neste pipeline' },
      })
      return
    }

    // Resolve the rotation pool of user IDs based on distributionType.
    // For SPECIFIC_USER it's a single-element list (so the round-robin
    // logic later still works — every lead gets the same one). For
    // ROUND_ROBIN_* it's the list of eligible sellers.
    let rotationPool: string[] = []
    let resolvedTeamId: string | null = null

    if (distributionType === 'SPECIFIC_USER') {
      let chosen = userId // fallback to current user
      if (responsibleId && responsibleId !== '') {
        const respUser = await prisma.user.findFirst({
          where: { id: responsibleId, tenantId, deletedAt: null },
          select: { id: true },
        })
        if (!respUser) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Responsável não encontrado neste tenant' },
          })
          return
        }
        chosen = respUser.id
      }
      rotationPool = [chosen]
    } else if (distributionType === 'ROUND_ROBIN_ALL') {
      const sellers = await prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          isActive: true,
          userStatus: 'ACTIVE',
          role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER'] },
        },
        select: { id: true },
        orderBy: { name: 'asc' },
      })
      if (sellers.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_SELLERS', message: 'Nenhum vendedor ativo encontrado para distribuição automática' },
        })
        return
      }
      rotationPool = sellers.map(s => s.id)
    } else if (distributionType === 'ROUND_ROBIN_TEAM') {
      if (!teamId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'teamId é obrigatório quando distributionType=ROUND_ROBIN_TEAM' },
        })
        return
      }
      const team = await prisma.team.findFirst({
        where: { id: teamId, tenantId },
        include: {
          members: {
            include: { user: { select: { id: true, isActive: true, userStatus: true, deletedAt: true } } },
          },
        },
      })
      if (!team) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Equipe não encontrada neste tenant' },
        })
        return
      }
      const activeMembers = team.members
        .filter(m => m.user.isActive && m.user.userStatus === 'ACTIVE' && m.user.deletedAt === null)
        .map(m => m.user.id)
      if (activeMembers.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'EMPTY_TEAM', message: 'A equipe selecionada não possui membros ativos' },
        })
        return
      }
      rotationPool = activeMembers
      resolvedTeamId = team.id
    }

    // Parse XLSX
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(req.file.buffer as unknown as ArrayBuffer)
    } catch {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: 'Não foi possível ler o arquivo. Use o modelo .xlsx fornecido.' },
      })
      return
    }

    const sheet = wb.worksheets[0]
    if (!sheet || sheet.rowCount < 2) {
      res.status(400).json({
        success: false,
        error: { code: 'EMPTY_FILE', message: 'O arquivo está vazio ou sem cabeçalho' },
      })
      return
    }

    // Read header row
    const headerRow = sheet.getRow(1)
    const headerToField: Record<number, string> = {}
    headerRow.eachCell((cell, colNumber) => {
      const text = cellText(cell).trim()
      const norm = normalizeKey(text)
      const field = HEADER_MAP[norm]
      if (field) headerToField[colNumber] = field
    })

    if (!Object.values(headerToField).includes('name')) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_NAME_COLUMN', message: 'Coluna "Nome" obrigatória não encontrada no arquivo' },
      })
      return
    }

    // Pre-load existing emails/phones/whatsapps for dedup (single query)
    const existing = await prisma.lead.findMany({
      where: { tenantId, deletedAt: null },
      select: { email: true, phone: true, whatsapp: true },
    })
    const existingEmails = new Set<string>()
    const existingPhones = new Set<string>()
    for (const e of existing) {
      const em = normalizeEmail(e.email)
      if (em) existingEmails.add(em)
      const ph = normalizePhone(e.phone)
      if (ph) existingPhones.add(ph)
      const wa = normalizePhone(e.whatsapp)
      if (wa) existingPhones.add(wa)
    }

    // Track in-file dedup
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()

    const valid: ImportRow[] = []
    const errorDetails: Array<{ row: number; reason: string }> = []
    let duplicates = 0

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      // Skip fully empty rows
      let hasAny = false
      row.eachCell({ includeEmpty: false }, () => { hasAny = true })
      if (!hasAny) continue

      const data: Record<string, unknown> = {}
      for (const colStr of Object.keys(headerToField)) {
        const col = Number(colStr)
        const field = headerToField[col]!
        data[field] = cellText(row.getCell(col)).trim() || null
      }

      const name = (data.name as string | null) ?? ''
      if (!name || name.length === 0) {
        errorDetails.push({ row: r, reason: 'Campo "Nome" vazio' })
        continue
      }

      const email = normalizeEmail(data.email as string | null)
      const phone = normalizePhone(data.phone as string | null)
      const whatsapp = normalizePhone(data.whatsapp as string | null)

      // Dedup against DB
      if (email && existingEmails.has(email)) { duplicates++; continue }
      if (phone && existingPhones.has(phone)) { duplicates++; continue }
      if (whatsapp && existingPhones.has(whatsapp)) { duplicates++; continue }
      // Dedup within file
      if (email && seenEmails.has(email)) { duplicates++; continue }
      if (phone && seenPhones.has(phone)) { duplicates++; continue }
      if (whatsapp && seenPhones.has(whatsapp)) { duplicates++; continue }

      if (email) seenEmails.add(email)
      if (phone) seenPhones.add(phone)
      if (whatsapp) seenPhones.add(whatsapp)

      valid.push({
        name,
        company: (data.company as string | null) || null,
        email: (data.email as string | null) || null,
        phone: (data.phone as string | null) || null,
        whatsapp: (data.whatsapp as string | null) || null,
        cpf: (data.cpf as string | null) || null,
        cnpj: (data.cnpj as string | null) || null,
        position: (data.position as string | null) || null,
        source: (data.source as string | null) || null,
        temperature: parseTemperature(data.temperature),
        expectedValue: parseDecimal(data.expectedValue),
        notes: (data.notes as string | null) || null,
      })
    }

    let imported = 0
    if (valid.length > 0) {
      const result = await prisma.lead.createMany({
        data: valid.map((v, i) => ({
          tenantId,
          pipelineId,
          stageId,
          responsibleId: rotationPool[i % rotationPool.length]!,
          teamId: resolvedTeamId,
          createdBy: userId,
          name: v.name,
          company: v.company,
          email: v.email,
          phone: v.phone,
          whatsapp: v.whatsapp,
          cpf: v.cpf,
          cnpj: v.cnpj,
          position: v.position,
          source: v.source,
          temperature: v.temperature ?? 'COLD',
          expectedValue: v.expectedValue,
          notes: v.notes,
          status: 'ACTIVE' as const,
        })),
      })
      imported = result.count
    }

    res.json({
      success: true,
      data: {
        imported,
        duplicates,
        errors: errorDetails.length,
        errorDetails: errorDetails.slice(0, 50),
      },
    })
  } catch (error: any) {
    console.error('[Leads] importLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: error?.code ?? 'INTERNAL_ERROR', message: error?.message ?? 'Erro ao importar leads' },
    })
  }
}

// ── Export Leads (xlsx or csv, all rows for the tenant respecting filters) ──

export async function exportLeads(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const { format = 'xlsx', search, pipelineId, stageId, status, temperature } =
      req.query as Record<string, string | undefined>

    if (format !== 'xlsx' && format !== 'csv') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'format deve ser xlsx ou csv' } })
      return
    }

    const where: Prisma.LeadWhereInput = { tenantId, deletedAt: null }
    if (status) where.status = status as 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'
    if (pipelineId) where.pipelineId = pipelineId
    if (stageId) where.stageId = stageId
    if (temperature) where.temperature = temperature as 'HOT' | 'WARM' | 'COLD'
    if (role === 'SELLER') where.responsibleId = userId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10000,
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const sheet = wb.addWorksheet('Leads')

    const headers = [
      'Nome', 'Empresa', 'E-mail', 'Telefone', 'WhatsApp',
      'CPF', 'CNPJ', 'Cargo', 'Origem', 'Temperatura', 'Valor Esperado',
      'Etapa', 'Pipeline', 'Responsável', 'Última Atividade', 'Data de Criação',
    ]
    sheet.addRow(headers)

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
    headerRow.height = 22

    const tempLabel: Record<string, string> = { HOT: 'Quente', WARM: 'Morno', COLD: 'Frio' }
    function fmtDate(d: Date | null | undefined): string {
      if (!d) return ''
      return new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    for (const l of leads) {
      sheet.addRow([
        l.name,
        l.company ?? '',
        l.email ?? '',
        l.phone ?? '',
        l.whatsapp ?? '',
        l.cpf ?? '',
        l.cnpj ?? '',
        l.position ?? '',
        l.source ?? '',
        tempLabel[l.temperature] ?? l.temperature,
        l.expectedValue ? Number(l.expectedValue) : '',
        l.stage?.name ?? '',
        l.pipeline?.name ?? '',
        l.responsible?.name ?? '',
        fmtDate(l.lastActivityAt),
        fmtDate(l.createdAt),
      ])
    }

    const widths = [22, 24, 28, 18, 18, 18, 22, 22, 16, 14, 16, 18, 18, 22, 22, 22]
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

    const today = new Date().toISOString().slice(0, 10)
    if (format === 'csv') {
      const buffer = await wb.csv.writeBuffer({ formatterOptions: { delimiter: ',', quote: '"' } } as any)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="leads_export_${today}.csv"`)
      // Prepend UTF-8 BOM so Excel opens with correct encoding
      res.send(Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(buffer as ArrayBuffer)]))
    } else {
      const buffer = await wb.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="leads_export_${today}.xlsx"`)
      res.send(Buffer.from(buffer as ArrayBuffer))
    }
  } catch (error: any) {
    console.error('[Leads] exportLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao exportar leads' },
    })
  }
}

// ── GET import template (xlsx, generated on-the-fly) ──

export async function getImportTemplate(_req: Request, res: Response): Promise<void> {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const sheet = wb.addWorksheet('Leads')

    const headers = [
      'Nome', 'Empresa', 'E-mail', 'Telefone', 'WhatsApp',
      'CPF', 'CNPJ', 'Cargo', 'Origem', 'Temperatura', 'Valor Esperado', 'Observações',
    ]
    sheet.addRow(headers)

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
    headerRow.height = 22

    sheet.addRow(['João Silva', 'Empresa ABC Ltda', 'joao@empresaabc.com.br', '(11) 99999-0001', '(11) 99999-0001', '123.456.789-00', '', 'Diretor Comercial', 'Instagram', 'Quente', 15000, 'Lead captado via campanha de fim de ano'])
    sheet.addRow(['Maria Santos', 'Tech Solutions', 'maria@techsolutions.com', '(21) 98888-0002', '(21) 98888-0002', '', '12.345.678/0001-90', 'CEO', 'Indicação', 'Morno', 8500, ''])
    sheet.addRow(['Pedro Oliveira', 'Comércio XYZ', 'pedro@xyz.com.br', '(31) 97777-0003', '', '987.654.321-00', '', 'Gerente', 'Site', 'Frio', '', 'Aguardando retorno na próxima semana'])

    const widths = [22, 24, 28, 18, 18, 18, 22, 22, 16, 14, 16, 36]
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

    const buffer = await wb.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-leads.xlsx"')
    res.send(Buffer.from(buffer as ArrayBuffer))
  } catch (error: any) {
    console.error('[Leads] getImportTemplate error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar modelo' } })
  }
}
