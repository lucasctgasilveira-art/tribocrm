import { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma'

// ── Helper: date range from period ──

function getDateRange(period: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate + 'T23:59:59.999Z') }
  }

  const now = new Date()

  if (period === 'today') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === 'week') {
    // Current week starting on Sunday (dayOfWeek 0) through "now".
    // Matches the PT-BR week convention used elsewhere in the app
    // (react-big-calendar localizer also uses ptBR's Sunday start).
    const dayOfWeek = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - dayOfWeek)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === 'quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3
    return {
      start: new Date(now.getFullYear(), qMonth, 1),
      end: new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999),
    }
  }

  if (period === 'year') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    }
  }

  // default: month
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

// ── GET /reports/gestao ──

export async function getGestaoReports(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const period = (req.query.period as string) || 'month'
    const { start, end } = getDateRange(period, req.query.startDate as string, req.query.endDate as string)

    // ── 1. KPIs ──

    const wonLeads = await prisma.lead.findMany({
      where: { tenantId, status: 'WON', wonAt: { gte: start, lte: end }, deletedAt: null },
      select: { closedValue: true },
    })
    const totalRevenue = wonLeads.reduce((s, l) => s + (l.closedValue ? Number(l.closedValue) : 0), 0)
    const wonCount = wonLeads.length

    const totalLeads = await prisma.lead.count({
      where: { tenantId, createdAt: { gte: start, lte: end }, deletedAt: null },
    })

    const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 1000) / 10 : 0
    const averageTicket = wonCount > 0 ? Math.round((totalRevenue / wonCount) * 100) / 100 : 0

    const kpis = { totalRevenue, totalLeads, conversionRate, averageTicket }

    // ── 2. Team Performance ──

    const users = await prisma.user.findMany({
      where: { tenantId, role: { in: ['SELLER', 'MANAGER', 'OWNER'] }, isActive: true, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
    })

    // Find goal for this period
    let periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY'
    let periodReference = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    if (period === 'quarter') {
      periodType = 'QUARTERLY'
      const q = Math.floor(start.getMonth() / 3) + 1
      periodReference = `${start.getFullYear()}-Q${q}`
    } else if (period === 'year') {
      periodType = 'YEARLY'
      periodReference = `${start.getFullYear()}`
    }

    const goalRecord = await prisma.goal.findFirst({
      where: { tenantId, periodType, periodReference },
      include: { individualGoals: true },
    })

    const teamPerformance = await Promise.all(
      users.map(async (user) => {
        const leadsCount = await prisma.lead.count({
          where: { tenantId, responsibleId: user.id, createdAt: { gte: start, lte: end }, deletedAt: null },
        })

        const userWonLeads = await prisma.lead.findMany({
          where: { tenantId, responsibleId: user.id, status: 'WON', wonAt: { gte: start, lte: end }, deletedAt: null },
          select: { closedValue: true },
        })

        const closingsCount = userWonLeads.length
        const revenue = userWonLeads.reduce((s, l) => s + (l.closedValue ? Number(l.closedValue) : 0), 0)
        const userConversionRate = leadsCount > 0 ? Math.round((closingsCount / leadsCount) * 1000) / 10 : 0

        let goalPercentage = 0
        if (goalRecord) {
          const indGoal = goalRecord.individualGoals.find(g => g.userId === user.id)
          const target = indGoal?.revenueGoal ? Number(indGoal.revenueGoal) : (goalRecord.totalRevenueGoal ? Number(goalRecord.totalRevenueGoal) / users.length : 0)
          goalPercentage = target > 0 ? Math.round((revenue / target) * 1000) / 10 : 0
        }

        return { id: user.id, name: user.name, avatarUrl: user.avatarUrl, leadsCount, closingsCount, conversionRate: userConversionRate, revenue, goalPercentage }
      })
    )

    teamPerformance.sort((a, b) => b.revenue - a.revenue)

    // ── 3. Loss Reasons ──

    const lostLeads = await prisma.lead.findMany({
      where: { tenantId, status: 'LOST', lostAt: { gte: start, lte: end }, deletedAt: null, lossReasonId: { not: null } },
      select: { lossReasonId: true },
    })

    // Fetch loss reason names
    const reasonIds = [...new Set(lostLeads.map(l => l.lossReasonId!).filter(Boolean))]
    const lossReasonRecords = reasonIds.length > 0
      ? await prisma.lossReason.findMany({ where: { id: { in: reasonIds } }, select: { id: true, name: true } })
      : []
    const reasonNameMap = new Map(lossReasonRecords.map(r => [r.id, r.name]))

    const reasonMap = new Map<string, { reason: string; count: number }>()
    for (const lead of lostLeads) {
      const name = reasonNameMap.get(lead.lossReasonId!) ?? 'Sem motivo'
      const entry = reasonMap.get(name)
      if (entry) entry.count++
      else reasonMap.set(name, { reason: name, count: 1 })
    }

    const totalLost = lostLeads.length
    const lossReasons = Array.from(reasonMap.values())
      .map(r => ({ ...r, percentage: totalLost > 0 ? Math.round((r.count / totalLost) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    // ── 4. Activities ──

    const interactions = await prisma.interaction.findMany({
      where: { tenantId, occurredAt: { gte: start, lte: end } },
      select: { type: true },
    })

    const activities = { calls: 0, whatsapp: 0, emails: 0, meetings: 0, visits: 0 }
    for (const i of interactions) {
      if (i.type === 'CALL') activities.calls++
      else if (i.type === 'WHATSAPP') activities.whatsapp++
      else if (i.type === 'EMAIL') activities.emails++
      else if (i.type === 'MEETING') activities.meetings++
      else if (i.type === 'VISIT') activities.visits++
    }

    // ── 5. Pipeline by Stage ──

    const defaultPipeline = await prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })

    const pipelineByStage = defaultPipeline
      ? await Promise.all(
          defaultPipeline.stages.map(async (stage) => {
            const stageLeads = await prisma.lead.findMany({
              where: { tenantId, stageId: stage.id, status: 'ACTIVE', deletedAt: null },
              select: { expectedValue: true },
            })
            return {
              stageName: stage.name,
              color: stage.color,
              count: stageLeads.length,
              value: stageLeads.reduce((s, l) => s + (l.expectedValue ? Number(l.expectedValue) : 0), 0),
            }
          })
        )
      : []

    // ── Response ──

    res.json({
      success: true,
      data: { kpis, teamPerformance, lossReasons, activities, pipelineByStage },
    })
  } catch (error) {
    console.error('[Reports] getGestaoReports error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // ── 1. KPIs ──

    // Revenue this month: sum closedValue of WON leads this month
    const wonLeadsThisMonth = await prisma.lead.findMany({
      where: {
        tenantId,
        status: 'WON',
        wonAt: { gte: startOfMonth, lte: endOfMonth },
        deletedAt: null,
      },
      select: { closedValue: true },
    })
    const revenueThisMonth = wonLeadsThisMonth.reduce(
      (sum, l) => sum + (l.closedValue ? Number(l.closedValue) : 0), 0
    )

    // Pipeline total: sum expectedValue of ACTIVE leads
    const activeLeads = await prisma.lead.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      select: { expectedValue: true },
    })
    const pipelineTotal = activeLeads.reduce(
      (sum, l) => sum + (l.expectedValue ? Number(l.expectedValue) : 0), 0
    )

    // Conversion rate: WON this month / total created this month
    const totalCreatedThisMonth = await prisma.lead.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        deletedAt: null,
      },
    })
    const wonCountThisMonth = wonLeadsThisMonth.length
    const conversionRate = totalCreatedThisMonth > 0
      ? Math.round((wonCountThisMonth / totalCreatedThisMonth) * 1000) / 10
      : 0

    // Pending approvals count
    const pendingApprovalsCount = await prisma.discountRequest.count({
      where: { tenantId, status: 'PENDING' },
    })

    const kpis = {
      revenueThisMonth,
      pipelineTotal,
      conversionRate,
      pendingApprovalsCount,
    }

    // ── 2. Goal (current month) ──

    const periodRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const goal = await prisma.goal.findFirst({
      where: {
        tenantId,
        periodType: 'MONTHLY',
        periodReference: periodRef,
      },
      select: {
        id: true,
        totalRevenueGoal: true,
        totalDealsGoal: true,
        goalType: true,
      },
    })

    let goalData = null
    if (goal) {
      const target = goal.totalRevenueGoal ? Number(goal.totalRevenueGoal) : 0
      const current = revenueThisMonth
      const percentage = target > 0 ? Math.round((current / target) * 1000) / 10 : 0
      goalData = { target, current, percentage }
    }

    // ── 3. Team Performance (top 5) ──

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SELLER', 'MANAGER', 'TEAM_LEADER'] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true, role: true },
    })

    const teamPerformance = await Promise.all(
      users.map(async (user) => {
        const leadsCount = await prisma.lead.count({
          where: { tenantId, responsibleId: user.id, status: 'ACTIVE', deletedAt: null },
        })

        const wonLeads = await prisma.lead.findMany({
          where: {
            tenantId,
            responsibleId: user.id,
            status: 'WON',
            wonAt: { gte: startOfMonth, lte: endOfMonth },
            deletedAt: null,
          },
          select: { closedValue: true },
        })

        const closingsCount = wonLeads.length
        const revenue = wonLeads.reduce(
          (sum, l) => sum + (l.closedValue ? Number(l.closedValue) : 0), 0
        )
        const totalForConversion = leadsCount + closingsCount
        const userConversionRate = totalForConversion > 0
          ? Math.round((closingsCount / totalForConversion) * 1000) / 10
          : 0

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          leadsCount,
          closingsCount,
          conversionRate: userConversionRate,
          revenue,
        }
      })
    )

    teamPerformance.sort((a, b) => b.revenue - a.revenue)
    const topTeam = teamPerformance.slice(0, 5)

    // ── 4. Pending Approvals (top 5) ──

    const pendingApprovals = await prisma.discountRequest.findMany({
      where: { tenantId, status: 'PENDING' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, price: true } },
      },
    })

    const approvalsWithDetails = await Promise.all(
      pendingApprovals.map(async (approval) => {
        const lead = await prisma.lead.findUnique({
          where: { id: approval.leadId },
          select: { id: true, name: true },
        })

        const requestedByUser = await prisma.user.findUnique({
          where: { id: approval.requestedBy },
          select: { id: true, name: true },
        })

        const originalPrice = approval.product.price ? Number(approval.product.price) : 0
        const discountAmount = Number(approval.requestedDiscount) || 0
        const requestedPrice = approval.discountType === 'PERCENTAGE'
          ? originalPrice * (1 - discountAmount / 100)
          : originalPrice - discountAmount

        return {
          id: approval.id,
          lead: lead ?? { id: approval.leadId, name: 'Desconhecido' },
          product: { id: approval.product.id, name: approval.product.name },
          requestedBy: requestedByUser ?? { id: approval.requestedBy, name: 'Desconhecido' },
          originalPrice,
          requestedPrice: Math.round(requestedPrice * 100) / 100,
          discountPercent: approval.discountType === 'PERCENTAGE'
            ? discountAmount
            : originalPrice > 0
              ? Math.round((discountAmount / originalPrice) * 1000) / 10
              : 0,
          createdAt: approval.createdAt,
        }
      })
    )

    // ── 5. Inactive Leads (top 5, no interaction > 5 days) ──

    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)

    const inactiveLeadsRaw = await prisma.lead.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { lastActivityAt: { lt: fiveDaysAgo } },
          { lastActivityAt: null },
        ],
      },
      orderBy: { lastActivityAt: 'asc' },
      take: 5,
      select: {
        id: true,
        name: true,
        company: true,
        lastActivityAt: true,
        responsible: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
      },
    })

    const inactiveLeads = inactiveLeadsRaw.map((lead) => {
      const daysSinceContact = lead.lastActivityAt
        ? Math.floor((now.getTime() - new Date(lead.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
        : null
      return { ...lead, daysSinceContact }
    })

    // ── Response ──

    res.json({
      success: true,
      data: {
        kpis,
        goal: goalData,
        teamPerformance: topTeam,
        pendingApprovals: approvalsWithDetails,
        inactiveLeads,
      },
    })
  } catch (error) {
    console.error('[Reports] getDashboard error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Excel export helpers ────────────────────────────────────

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Sends an ExcelJS Workbook over the Express response with the right
// headers and a buffered body. Keeping this factored out avoids the
// four handlers duplicating the Content-Type / Disposition dance.
async function streamWorkbook(res: Response, workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  res.setHeader('Content-Type', XLSX_MIME)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Length', String(buffer.byteLength))
  res.end(Buffer.from(buffer as ArrayBuffer))
}

function applyHeaderStyle(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true }
}

// Coerce a Prisma Decimal / number / null to a plain JS number for
// Excel cell writes. Excel doesn't understand Prisma.Decimal.
function num(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  // Prisma.Decimal has .toNumber()
  const maybe = v as { toNumber?: () => number }
  if (typeof maybe.toNumber === 'function') return maybe.toNumber()
  return 0
}

// Short human period label used in filename / default-period hint.
function periodSuffix(period: string): string {
  return period || 'periodo'
}

// ── GET /reports/export/gestor ──────────────────────────────

export async function exportGestaoReport(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const period = (req.query.period as string) || 'month'
    const { start, end } = getDateRange(period, req.query.startDate as string, req.query.endDate as string)

    // ── KPIs ──
    const wonLeads = await prisma.lead.findMany({
      where: { tenantId, status: 'WON', wonAt: { gte: start, lte: end }, deletedAt: null },
      select: { closedValue: true },
    })
    const totalRevenue = wonLeads.reduce((s, l) => s + num(l.closedValue), 0)
    const wonCount = wonLeads.length
    const totalLeads = await prisma.lead.count({
      where: { tenantId, createdAt: { gte: start, lte: end }, deletedAt: null },
    })
    const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 1000) / 10 : 0
    const averageTicket = wonCount > 0 ? Math.round((totalRevenue / wonCount) * 100) / 100 : 0

    // ── Team ──
    const users = await prisma.user.findMany({
      where: { tenantId, role: { in: ['SELLER', 'TEAM_LEADER', 'MANAGER', 'OWNER'] }, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const teamRows = await Promise.all(
      users.map(async (u) => {
        const leadsCount = await prisma.lead.count({
          where: { tenantId, responsibleId: u.id, createdAt: { gte: start, lte: end }, deletedAt: null },
        })
        const userWon = await prisma.lead.findMany({
          where: { tenantId, responsibleId: u.id, status: 'WON', wonAt: { gte: start, lte: end }, deletedAt: null },
          select: { closedValue: true },
        })
        const closings = userWon.length
        const revenue = userWon.reduce((s, l) => s + num(l.closedValue), 0)
        const userConv = leadsCount > 0 ? Math.round((closings / leadsCount) * 1000) / 10 : 0
        return { name: u.name, leads: leadsCount, sales: closings, revenue, conversion: userConv }
      }),
    )

    // ── Loss reasons ──
    const lostLeads = await prisma.lead.findMany({
      where: { tenantId, status: 'LOST', lostAt: { gte: start, lte: end }, deletedAt: null, lossReasonId: { not: null } },
      select: { lossReasonId: true },
    })
    const reasonIds = [...new Set(lostLeads.map(l => l.lossReasonId!).filter(Boolean))]
    const reasons = reasonIds.length > 0
      ? await prisma.lossReason.findMany({ where: { id: { in: reasonIds } }, select: { id: true, name: true } })
      : []
    const reasonName = new Map(reasons.map(r => [r.id, r.name]))
    const reasonCounts = new Map<string, number>()
    for (const l of lostLeads) {
      const name = reasonName.get(l.lossReasonId!) ?? 'Sem motivo'
      reasonCounts.set(name, (reasonCounts.get(name) ?? 0) + 1)
    }
    const totalLost = lostLeads.length
    const lossRows = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count, percentage: totalLost > 0 ? Math.round((count / totalLost) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    // ── Workbook ──
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const wsKpis = wb.addWorksheet('KPIs')
    wsKpis.columns = [
      { header: 'Métrica', key: 'metric', width: 28 },
      { header: 'Valor', key: 'value', width: 20 },
    ]
    wsKpis.addRow({ metric: 'Período', value: period })
    wsKpis.addRow({ metric: 'Início', value: start.toLocaleDateString('pt-BR') })
    wsKpis.addRow({ metric: 'Fim', value: end.toLocaleDateString('pt-BR') })
    wsKpis.addRow({ metric: 'Receita Fechada (R$)', value: totalRevenue })
    wsKpis.addRow({ metric: 'Leads Gerados', value: totalLeads })
    wsKpis.addRow({ metric: 'Vendas', value: wonCount })
    wsKpis.addRow({ metric: 'Taxa de Conversão (%)', value: conversionRate })
    wsKpis.addRow({ metric: 'Ticket Médio (R$)', value: averageTicket })
    applyHeaderStyle(wsKpis)

    const wsTeam = wb.addWorksheet('Equipe')
    wsTeam.columns = [
      { header: 'Vendedor', key: 'name', width: 32 },
      { header: 'Leads', key: 'leads', width: 12 },
      { header: 'Vendas', key: 'sales', width: 12 },
      { header: 'Receita (R$)', key: 'revenue', width: 18 },
      { header: 'Conversão (%)', key: 'conversion', width: 16 },
    ]
    teamRows.forEach(r => wsTeam.addRow(r))
    applyHeaderStyle(wsTeam)

    const wsLoss = wb.addWorksheet('Motivos de Perda')
    wsLoss.columns = [
      { header: 'Motivo', key: 'reason', width: 40 },
      { header: 'Quantidade', key: 'count', width: 14 },
      { header: 'Percentual (%)', key: 'percentage', width: 16 },
    ]
    lossRows.forEach(r => wsLoss.addRow(r))
    applyHeaderStyle(wsLoss)

    await streamWorkbook(res, wb, `relatorio-gestor-${periodSuffix(period)}.xlsx`)
  } catch (error) {
    console.error('[Reports] exportGestaoReport error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── GET /reports/export/vendedor ────────────────────────────

export async function exportVendedorReport(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const period = (req.query.period as string) || 'month'
    const { start, end } = getDateRange(period, req.query.startDate as string, req.query.endDate as string)

    // ── Personal KPIs ──
    const myWon = await prisma.lead.findMany({
      where: { tenantId, responsibleId: userId, status: 'WON', wonAt: { gte: start, lte: end }, deletedAt: null },
      select: { closedValue: true },
    })
    const myRevenue = myWon.reduce((s, l) => s + num(l.closedValue), 0)
    const mySales = myWon.length
    const myLeads = await prisma.lead.count({
      where: { tenantId, responsibleId: userId, createdAt: { gte: start, lte: end }, deletedAt: null },
    })
    const myConversion = myLeads > 0 ? Math.round((mySales / myLeads) * 1000) / 10 : 0
    const myTicket = mySales > 0 ? Math.round((myRevenue / mySales) * 100) / 100 : 0

    // ── Activities ──
    const myInteractions = await prisma.interaction.findMany({
      where: { tenantId, userId, occurredAt: { gte: start, lte: end } },
      select: { type: true },
    })
    const acts = { calls: 0, whatsapp: 0, emails: 0, meetings: 0, visits: 0 }
    for (const i of myInteractions) {
      if (i.type === 'CALL') acts.calls++
      else if (i.type === 'WHATSAPP') acts.whatsapp++
      else if (i.type === 'EMAIL') acts.emails++
      else if (i.type === 'MEETING') acts.meetings++
      else if (i.type === 'VISIT') acts.visits++
    }

    // ── Personal loss reasons ──
    const myLost = await prisma.lead.findMany({
      where: { tenantId, responsibleId: userId, status: 'LOST', lostAt: { gte: start, lte: end }, deletedAt: null, lossReasonId: { not: null } },
      select: { lossReasonId: true },
    })
    const myReasonIds = [...new Set(myLost.map(l => l.lossReasonId!).filter(Boolean))]
    const myReasons = myReasonIds.length > 0
      ? await prisma.lossReason.findMany({ where: { id: { in: myReasonIds } }, select: { id: true, name: true } })
      : []
    const myReasonName = new Map(myReasons.map(r => [r.id, r.name]))
    const myReasonCounts = new Map<string, number>()
    for (const l of myLost) {
      const name = myReasonName.get(l.lossReasonId!) ?? 'Sem motivo'
      myReasonCounts.set(name, (myReasonCounts.get(name) ?? 0) + 1)
    }
    const myTotalLost = myLost.length
    const myLossRows = Array.from(myReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count, percentage: myTotalLost > 0 ? Math.round((count / myTotalLost) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    // ── Workbook ──
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const wsMine = wb.addWorksheet('Meus Resultados')
    wsMine.columns = [
      { header: 'Métrica', key: 'metric', width: 28 },
      { header: 'Valor', key: 'value', width: 20 },
    ]
    wsMine.addRow({ metric: 'Período', value: period })
    wsMine.addRow({ metric: 'Início', value: start.toLocaleDateString('pt-BR') })
    wsMine.addRow({ metric: 'Fim', value: end.toLocaleDateString('pt-BR') })
    wsMine.addRow({ metric: 'Receita Fechada (R$)', value: myRevenue })
    wsMine.addRow({ metric: 'Leads Recebidos', value: myLeads })
    wsMine.addRow({ metric: 'Vendas', value: mySales })
    wsMine.addRow({ metric: 'Conversão (%)', value: myConversion })
    wsMine.addRow({ metric: 'Ticket Médio (R$)', value: myTicket })
    applyHeaderStyle(wsMine)

    const wsActs = wb.addWorksheet('Atividades')
    wsActs.columns = [
      { header: 'Tipo', key: 'type', width: 24 },
      { header: 'Quantidade', key: 'count', width: 14 },
    ]
    wsActs.addRow({ type: 'Ligações', count: acts.calls })
    wsActs.addRow({ type: 'WhatsApp', count: acts.whatsapp })
    wsActs.addRow({ type: 'E-mails', count: acts.emails })
    wsActs.addRow({ type: 'Reuniões', count: acts.meetings })
    wsActs.addRow({ type: 'Visitas', count: acts.visits })
    applyHeaderStyle(wsActs)

    const wsLoss = wb.addWorksheet('Motivos de Perda')
    wsLoss.columns = [
      { header: 'Motivo', key: 'reason', width: 40 },
      { header: 'Quantidade', key: 'count', width: 14 },
      { header: 'Percentual (%)', key: 'percentage', width: 16 },
    ]
    myLossRows.forEach(r => wsLoss.addRow(r))
    applyHeaderStyle(wsLoss)

    await streamWorkbook(res, wb, `meus-resultados-${periodSuffix(period)}.xlsx`)
  } catch (error) {
    console.error('[Reports] exportVendedorReport error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── GET /reports/export/admin-financeiro ────────────────────
// Gated upstream by the adminOnly middleware on the admin router.

export async function exportAdminFinanceiro(req: Request, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) || 'month'
    const { start, end } = getDateRange(period, req.query.startDate as string, req.query.endDate as string)

    // ── Financeiro aggregates ──
    // MRR proxy: sum of ACTIVE tenants' monthly plan price. ExcelJS
    // export mirrors what getFinancial currently computes without
    // touching that handler — the shape is intentionally minimal.
    const activeTenants = await prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      include: { plan: true },
    })
    const mrr = activeTenants.reduce((s, t) => s + num(t.plan.priceMonthly), 0)
    const arr = mrr * 12

    const periodCharges = await prisma.charge.findMany({
      where: { dueDate: { gte: start, lte: end } },
      include: { tenant: { select: { name: true, plan: { select: { name: true } } } } },
      orderBy: { dueDate: 'desc' },
      take: 500,
    })
    const paidCharges = periodCharges.filter(c => c.status === 'PAID')
    const ticketMedio = paidCharges.length > 0
      ? paidCharges.reduce((s, c) => s + num(c.amount), 0) / paidCharges.length
      : 0

    const cancelledInPeriod = await prisma.tenant.count({
      where: { status: 'CANCELLED', updatedAt: { gte: start, lte: end } },
    })
    const churnRate = activeTenants.length > 0
      ? Math.round((cancelledInPeriod / (activeTenants.length + cancelledInPeriod)) * 1000) / 10
      : 0

    // ── Novos tenants do período ──
    const newTenants = await prisma.tenant.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { plan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // ── Workbook ──
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const wsFin = wb.addWorksheet('Financeiro')
    wsFin.columns = [
      { header: 'Métrica', key: 'metric', width: 28 },
      { header: 'Valor', key: 'value', width: 20 },
    ]
    wsFin.addRow({ metric: 'Período', value: period })
    wsFin.addRow({ metric: 'Início', value: start.toLocaleDateString('pt-BR') })
    wsFin.addRow({ metric: 'Fim', value: end.toLocaleDateString('pt-BR') })
    wsFin.addRow({ metric: 'MRR (R$)', value: mrr })
    wsFin.addRow({ metric: 'ARR (R$)', value: arr })
    wsFin.addRow({ metric: 'Ticket Médio (R$)', value: Math.round(ticketMedio * 100) / 100 })
    wsFin.addRow({ metric: 'Churn Rate (%)', value: churnRate })
    wsFin.addRow({ metric: 'Tenants Ativos', value: activeTenants.length })
    wsFin.addRow({ metric: 'Cancelamentos no período', value: cancelledInPeriod })
    applyHeaderStyle(wsFin)

    const wsCharges = wb.addWorksheet('Cobranças')
    wsCharges.columns = [
      { header: 'Tenant', key: 'tenant', width: 32 },
      { header: 'Plano', key: 'plan', width: 18 },
      { header: 'Valor (R$)', key: 'amount', width: 16 },
      { header: 'Vencimento', key: 'dueDate', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
    ]
    periodCharges.forEach(c => {
      wsCharges.addRow({
        tenant: c.tenant?.name ?? '—',
        plan: c.tenant?.plan?.name ?? '—',
        amount: num(c.amount),
        dueDate: c.dueDate ? new Date(c.dueDate).toLocaleDateString('pt-BR') : '—',
        status: c.status,
      })
    })
    applyHeaderStyle(wsCharges)

    const wsClientes = wb.addWorksheet('Clientes')
    wsClientes.columns = [
      { header: 'Nome', key: 'name', width: 32 },
      { header: 'E-mail', key: 'email', width: 32 },
      { header: 'Plano', key: 'plan', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Criado em', key: 'createdAt', width: 16 },
    ]
    newTenants.forEach(t => {
      wsClientes.addRow({
        name: t.name,
        email: t.email,
        plan: t.plan?.name ?? '—',
        status: t.status,
        createdAt: new Date(t.createdAt).toLocaleDateString('pt-BR'),
      })
    })
    applyHeaderStyle(wsClientes)

    await streamWorkbook(res, wb, `admin-financeiro-${periodSuffix(period)}.xlsx`)
  } catch (error) {
    console.error('[Reports] exportAdminFinanceiro error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── GET /reports/export/admin-dashboard ─────────────────────
// Gated upstream by the adminOnly middleware on the admin router.

export async function exportAdminDashboard(req: Request, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) || 'month'
    const { start, end } = getDateRange(period, req.query.startDate as string, req.query.endDate as string)

    // ── Platform KPIs ──
    const totalTenants = await prisma.tenant.count()
    const activeTenants = await prisma.tenant.count({ where: { status: 'ACTIVE' } })
    const trialTenants = await prisma.tenant.count({ where: { status: 'TRIAL' } })
    const suspendedTenants = await prisma.tenant.count({ where: { status: 'SUSPENDED' } })
    const cancelledTenants = await prisma.tenant.count({ where: { status: 'CANCELLED' } })
    const newInPeriod = await prisma.tenant.count({ where: { createdAt: { gte: start, lte: end } } })
    const totalUsers = await prisma.user.count({ where: { deletedAt: null, isActive: true } })
    const totalLeads = await prisma.lead.count({ where: { deletedAt: null } })
    const totalWon = await prisma.lead.count({ where: { status: 'WON', deletedAt: null, wonAt: { gte: start, lte: end } } })

    const activeTenantRows = await prisma.tenant.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      include: { plan: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    // ── Workbook ──
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TriboCRM'
    wb.created = new Date()

    const wsOverview = wb.addWorksheet('Visão Geral')
    wsOverview.columns = [
      { header: 'Métrica', key: 'metric', width: 32 },
      { header: 'Valor', key: 'value', width: 16 },
    ]
    wsOverview.addRow({ metric: 'Período', value: period })
    wsOverview.addRow({ metric: 'Início', value: start.toLocaleDateString('pt-BR') })
    wsOverview.addRow({ metric: 'Fim', value: end.toLocaleDateString('pt-BR') })
    wsOverview.addRow({ metric: 'Total de Tenants', value: totalTenants })
    wsOverview.addRow({ metric: 'Tenants Ativos', value: activeTenants })
    wsOverview.addRow({ metric: 'Tenants em Trial', value: trialTenants })
    wsOverview.addRow({ metric: 'Tenants Suspensos', value: suspendedTenants })
    wsOverview.addRow({ metric: 'Tenants Cancelados', value: cancelledTenants })
    wsOverview.addRow({ metric: 'Novos Tenants no período', value: newInPeriod })
    wsOverview.addRow({ metric: 'Total de Usuários Ativos', value: totalUsers })
    wsOverview.addRow({ metric: 'Leads Totais', value: totalLeads })
    wsOverview.addRow({ metric: 'Vendas no período', value: totalWon })
    applyHeaderStyle(wsOverview)

    const wsTenants = wb.addWorksheet('Tenants Ativos')
    wsTenants.columns = [
      { header: 'Nome', key: 'name', width: 32 },
      { header: 'E-mail', key: 'email', width: 32 },
      { header: 'Plano', key: 'plan', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Criado em', key: 'createdAt', width: 16 },
    ]
    activeTenantRows.forEach(t => {
      wsTenants.addRow({
        name: t.name,
        email: t.email,
        plan: t.plan?.name ?? '—',
        status: t.status,
        createdAt: new Date(t.createdAt).toLocaleDateString('pt-BR'),
      })
    })
    applyHeaderStyle(wsTenants)

    await streamWorkbook(res, wb, `admin-dashboard-${periodSuffix(period)}.xlsx`)
  } catch (error) {
    console.error('[Reports] exportAdminDashboard error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
