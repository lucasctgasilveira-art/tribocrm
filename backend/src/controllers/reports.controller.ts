import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

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
