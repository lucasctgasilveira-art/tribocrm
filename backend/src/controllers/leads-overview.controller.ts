/**
 * Dashboard de Leads consolidado pro Super Admin.
 *
 * Mostra KPIs cruzando todos os tenants da plataforma:
 *   - Quantos clientes / vendedores / leads ativos
 *   - Distribuição de leads por status (ativo, vendido, perdido, arquivado)
 *   - Valor em negociação (soma expectedValue dos ACTIVE)
 *   - Receita finalizada (soma closedValue dos WON)
 *
 * Filtros aceitos:
 *   - tenantId        → focar em 1 cliente específico
 *   - clientStatus    → 'active' (ACTIVE+TRIAL) | 'inactive' (PAYMENT_OVERDUE+SUSPENDED+CANCELLED) | 'all'
 *   - sellerStatus    → 'active' | 'inactive' | 'all'
 *   - leadStatus      → 'active' (ACTIVE) | 'inactive' (WON+LOST) | 'archived' (ARCHIVED) | 'all'
 *   - periodType      → MONTHLY | QUARTERLY | SEMESTRAL | YEARLY
 *   - periodReference → "YYYY-MM" | "YYYY-Q1..Q4" | "YYYY-S1..S2" | "YYYY"
 *
 * Rotas:
 *   GET /admin/leads-overview         → JSON com KPIs
 *   GET /admin/leads-export           → stream CSV
 *
 * Restrição: só SUPER_ADMIN (middleware `adminOnly` já aplicado em
 * admin.routes.ts).
 */

import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { isValidPeriodReference, getMonthsInPeriod, type AggregationPeriod } from '../lib/periodReference'

type ClientFilter = 'all' | 'active' | 'inactive'
type SellerFilter = 'all' | 'active' | 'inactive'
type LeadFilter = 'all' | 'active' | 'inactive' | 'archived'

const ACTIVE_TENANT_STATUSES = ['ACTIVE', 'TRIAL'] as const
const INACTIVE_TENANT_STATUSES = ['PAYMENT_OVERDUE', 'SUSPENDED', 'CANCELLED'] as const

interface DateRange {
  start: Date
  end: Date
}

/**
 * Converte periodType+periodReference em range Date inclusivo (1º dia
 * do primeiro mês 00:00 até último dia do último mês 23:59:59.999).
 * Retorna null se o período é inválido.
 */
function periodToDateRange(periodType: AggregationPeriod, periodReference: string): DateRange | null {
  if (!isValidPeriodReference(periodType, periodReference)) return null
  const months = getMonthsInPeriod(periodType, periodReference)
  if (months.length === 0) return null
  const first = months[0]!.split('-').map(s => parseInt(s, 10))
  const last = months[months.length - 1]!.split('-').map(s => parseInt(s, 10))
  const start = new Date(first[0]!, first[1]! - 1, 1, 0, 0, 0, 0)
  const end = new Date(last[0]!, last[1]!, 0, 23, 59, 59, 999) // last day of last month
  return { start, end }
}

/**
 * Builder de WHERE compartilhado entre overview e export. Filtra por:
 *   - tenant (se especificado) ou status do tenant (active/inactive)
 *   - status do lead (se diferente de 'all')
 *   - status do vendedor (se diferente de 'all') via responsible
 *   - período (createdAt do lead, mais inclusivo — vende e perde
 *     são derivados desse mesmo lead criado)
 *
 * Pra os KPIs que precisam de granularidade temporal específica
 * (vendido NO período, perdido NO período), usamos overrides em
 * cada count separadamente.
 */
function buildLeadWhereBase(opts: {
  tenantId?: string | null
  clientStatus: ClientFilter
  sellerStatus: SellerFilter
}): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { deletedAt: null }

  if (opts.tenantId) {
    where.tenantId = opts.tenantId
  } else if (opts.clientStatus === 'active') {
    where.tenant = { status: { in: ACTIVE_TENANT_STATUSES as unknown as ('ACTIVE' | 'TRIAL')[] } }
  } else if (opts.clientStatus === 'inactive') {
    where.tenant = { status: { in: INACTIVE_TENANT_STATUSES as unknown as ('PAYMENT_OVERDUE' | 'SUSPENDED' | 'CANCELLED')[] } }
  }

  if (opts.sellerStatus === 'active') {
    where.responsible = { isActive: true, deletedAt: null }
  } else if (opts.sellerStatus === 'inactive') {
    where.responsible = { isActive: false }
  }

  return where
}

function parseFilters(req: Request) {
  const q = req.query as Record<string, string | undefined>
  const tenantId = q.tenantId && q.tenantId !== 'all' ? q.tenantId : null
  const clientStatus = (q.clientStatus ?? 'active') as ClientFilter
  const sellerStatus = (q.sellerStatus ?? 'all') as SellerFilter
  const leadStatus = (q.leadStatus ?? 'all') as LeadFilter
  const periodType = (q.periodType ?? 'MONTHLY') as AggregationPeriod
  const periodReference = q.periodReference ?? defaultPeriodReference(periodType)
  return { tenantId, clientStatus, sellerStatus, leadStatus, periodType, periodReference }
}

function defaultPeriodReference(periodType: AggregationPeriod): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  if (periodType === 'MONTHLY') return `${y}-${String(m).padStart(2, '0')}`
  if (periodType === 'QUARTERLY') return `${y}-Q${Math.ceil(m / 3)}`
  if (periodType === 'SEMESTRAL') return `${y}-S${m <= 6 ? 1 : 2}`
  return `${y}` // YEARLY
}

export async function getLeadsOverview(req: Request, res: Response): Promise<void> {
  try {
    const f = parseFilters(req)
    const range = periodToDateRange(f.periodType, f.periodReference)
    if (!range) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'periodType ou periodReference inválido' },
      })
      return
    }

    // Tenants ativos/inativos (sempre estado atual — período não aplica)
    const [tenantsActive, tenantsInactive] = await Promise.all([
      prisma.tenant.count({ where: { status: { in: ACTIVE_TENANT_STATUSES as unknown as ('ACTIVE' | 'TRIAL')[] } } }),
      prisma.tenant.count({ where: { status: { in: INACTIVE_TENANT_STATUSES as unknown as ('PAYMENT_OVERDUE' | 'SUSPENDED' | 'CANCELLED')[] } } }),
    ])

    // Vendedores ativos/inativos (sempre estado atual). Filtra por
    // tenant escolhido ou status do tenant pra coerência com o cliente
    // selecionado.
    const sellerTenantWhere: Prisma.UserWhereInput = {}
    if (f.tenantId) {
      sellerTenantWhere.tenantId = f.tenantId
    } else if (f.clientStatus === 'active') {
      sellerTenantWhere.tenant = { status: { in: ACTIVE_TENANT_STATUSES as unknown as ('ACTIVE' | 'TRIAL')[] } }
    } else if (f.clientStatus === 'inactive') {
      sellerTenantWhere.tenant = { status: { in: INACTIVE_TENANT_STATUSES as unknown as ('PAYMENT_OVERDUE' | 'SUSPENDED' | 'CANCELLED')[] } }
    }
    const sellerRoleFilter = { role: { in: ['SELLER', 'TEAM_LEADER'] as ('SELLER' | 'TEAM_LEADER')[] }, deletedAt: null }
    const [sellersActive, sellersInactive] = await Promise.all([
      prisma.user.count({ where: { ...sellerTenantWhere, ...sellerRoleFilter, isActive: true } }),
      prisma.user.count({ where: { ...sellerTenantWhere, ...sellerRoleFilter, isActive: false } }),
    ])

    // Base do where dos leads (sem status/período — aplicamos por
    // contagem específica)
    const baseLeadWhere = buildLeadWhereBase({
      tenantId: f.tenantId,
      clientStatus: f.clientStatus,
      sellerStatus: f.sellerStatus,
    })

    // Aplica filtro de leadStatus geral (se "all", sem restrição extra;
    // senão, aplicar antes nas métricas pra economizar query)
    const includeActive = f.leadStatus === 'all' || f.leadStatus === 'active'
    const includeWonLost = f.leadStatus === 'all' || f.leadStatus === 'inactive'
    const includeArchived = f.leadStatus === 'all' || f.leadStatus === 'archived'

    // Totais por status — período aplica conforme timestamp do evento:
    //   ACTIVE  → createdAt no período
    //   WON     → wonAt no período
    //   LOST    → lostAt no período
    //   ARCHIVED→ updatedAt no período (não há archivedAt no schema)
    const queries: Promise<unknown>[] = []
    queries.push(
      includeActive
        ? prisma.lead.count({ where: { ...baseLeadWhere, status: 'ACTIVE', createdAt: { gte: range.start, lte: range.end } } })
        : Promise.resolve(0),
    )
    queries.push(
      includeWonLost
        ? prisma.lead.count({ where: { ...baseLeadWhere, status: 'WON', wonAt: { gte: range.start, lte: range.end } } })
        : Promise.resolve(0),
    )
    queries.push(
      includeWonLost
        ? prisma.lead.count({ where: { ...baseLeadWhere, status: 'LOST', lostAt: { gte: range.start, lte: range.end } } })
        : Promise.resolve(0),
    )
    queries.push(
      includeArchived
        ? prisma.lead.count({ where: { ...baseLeadWhere, status: 'ARCHIVED', updatedAt: { gte: range.start, lte: range.end } } })
        : Promise.resolve(0),
    )

    // Valores monetários
    queries.push(
      includeActive
        ? prisma.lead.aggregate({
          where: { ...baseLeadWhere, status: 'ACTIVE', createdAt: { gte: range.start, lte: range.end } },
          _sum: { expectedValue: true },
        })
        : Promise.resolve({ _sum: { expectedValue: null } } as never),
    )
    queries.push(
      includeWonLost
        ? prisma.lead.aggregate({
          where: { ...baseLeadWhere, status: 'WON', wonAt: { gte: range.start, lte: range.end } },
          _sum: { closedValue: true },
        })
        : Promise.resolve({ _sum: { closedValue: null } } as never),
    )

    const [
      leadsActive,
      leadsWon,
      leadsLost,
      leadsArchived,
      sumExpected,
      sumClosed,
    ] = await Promise.all(queries) as [
      number, number, number, number,
      { _sum: { expectedValue: Prisma.Decimal | null } },
      { _sum: { closedValue: Prisma.Decimal | null } },
    ]

    res.json({
      success: true,
      data: {
        filters: f,
        clients: { active: tenantsActive, inactive: tenantsInactive },
        sellers: { active: sellersActive, inactive: sellersInactive },
        leads: {
          active: leadsActive,
          won: leadsWon,
          lost: leadsLost,
          archived: leadsArchived,
        },
        revenue: {
          inNegotiation: sumExpected._sum.expectedValue ? Number(sumExpected._sum.expectedValue) : 0,
          finalized: sumClosed._sum.closedValue ? Number(sumClosed._sum.closedValue) : 0,
        },
      },
    })
  } catch (error) {
    console.error('[LeadsOverview] getLeadsOverview error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── CSV Export ───────────────────────────────────────────────

/**
 * Escapa um valor pra CSV: envolve em aspas duplas se contém vírgula,
 * aspas, ou quebra de linha; aspas internas viram "" (RFC 4180).
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusLabel(s: 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'): string {
  return s === 'ACTIVE' ? 'Ativo' : s === 'WON' ? 'Vendido' : s === 'LOST' ? 'Perdido' : 'Arquivado'
}

export async function exportLeads(req: Request, res: Response): Promise<void> {
  try {
    const f = parseFilters(req)
    const range = periodToDateRange(f.periodType, f.periodReference)
    if (!range) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'periodType ou periodReference inválido' },
      })
      return
    }

    const baseLeadWhere = buildLeadWhereBase({
      tenantId: f.tenantId,
      clientStatus: f.clientStatus,
      sellerStatus: f.sellerStatus,
    })

    // Filtro de status + período — combina via OR pra não excluir
    // leads que entraram no recorte por timestamp diferente.
    const periodOR: Prisma.LeadWhereInput[] = []
    if (f.leadStatus === 'all' || f.leadStatus === 'active') {
      periodOR.push({ status: 'ACTIVE', createdAt: { gte: range.start, lte: range.end } })
    }
    if (f.leadStatus === 'all' || f.leadStatus === 'inactive') {
      periodOR.push({ status: 'WON', wonAt: { gte: range.start, lte: range.end } })
      periodOR.push({ status: 'LOST', lostAt: { gte: range.start, lte: range.end } })
    }
    if (f.leadStatus === 'all' || f.leadStatus === 'archived') {
      periodOR.push({ status: 'ARCHIVED', updatedAt: { gte: range.start, lte: range.end } })
    }
    const fullWhere: Prisma.LeadWhereInput = periodOR.length > 0
      ? { ...baseLeadWhere, OR: periodOR }
      : baseLeadWhere

    const leads = await prisma.lead.findMany({
      where: fullWhere,
      include: {
        tenant: { select: { name: true } },
        responsible: { select: { name: true } },
        pipeline: { select: { name: true } },
        stage: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50000, // teto de segurança contra OOM
    })

    const headers = [
      'Cliente', 'Vendedor responsável', 'Lead', 'Empresa', 'E-mail', 'Telefone',
      'Pipeline', 'Etapa', 'Status', 'Valor esperado (R$)', 'Valor fechado (R$)',
      'Criado em', 'Vendido em', 'Perdido em',
    ]

    const lines: string[] = []
    lines.push(headers.map(csvEscape).join(','))

    for (const l of leads) {
      lines.push([
        l.tenant?.name ?? '',
        l.responsible?.name ?? '',
        l.name,
        l.company ?? '',
        l.email ?? '',
        l.phone ?? l.whatsapp ?? '',
        l.pipeline?.name ?? '',
        l.stage?.name ?? '',
        statusLabel(l.status as 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED'),
        l.expectedValue ? Number(l.expectedValue).toFixed(2).replace('.', ',') : '',
        l.closedValue ? Number(l.closedValue).toFixed(2).replace('.', ',') : '',
        fmtDate(l.createdAt),
        fmtDate(l.wonAt),
        fmtDate(l.lostAt),
      ].map(csvEscape).join(','))
    }

    // BOM UTF-8 (﻿) faz Excel abrir com acentos certos.
    const csv = '﻿' + lines.join('\r\n')
    const filename = `leads-${f.periodReference}-${Date.now()}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (error) {
    console.error('[LeadsOverview] exportLeads error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

/**
 * Lista de tenants ativos/todos pro dropdown de filtro do Super Admin.
 * Endpoint mais simples que o getTenants existente — só id+name+status.
 */
export async function getTenantsForFilter(_req: Request, res: Response): Promise<void> {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: tenants })
  } catch (error) {
    console.error('[LeadsOverview] getTenantsForFilter error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
