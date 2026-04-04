import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// ── Helper: date range from period ──

function getDateRange(period: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate + 'T23:59:59.999Z') }
  }

  const now = new Date()

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
