import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ── Dashboard ──

export async function getAdminDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // MRR: sum of paid charges this month
    const paidCharges = await prisma.charge.findMany({
      where: { status: 'PAID', paidAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    })
    const mrr = paidCharges.reduce((sum, c) => sum + Number(c.amount), 0)
    const arr = mrr * 12

    // New tenants this month
    const newTenantsThisMonth = await prisma.tenant.count({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
    })

    // Delinquent: tenants with SUSPENDED status
    const delinquentCount = await prisma.tenant.count({
      where: { status: 'SUSPENDED' },
    })

    // MRR History (last 6 months)
    const mrrHistory: { month: string; value: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

      const monthCharges = await prisma.charge.findMany({
        where: { status: 'PAID', paidAt: { gte: monthStart, lte: monthEnd } },
        select: { amount: true },
      })
      const monthTotal = monthCharges.reduce((sum, c) => sum + Number(c.amount), 0)
      const monthLabel = `${d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(d.getFullYear()).slice(2)}`
      mrrHistory.push({ month: monthLabel, value: monthTotal })
    }

    // Alerts: overdue charges
    const overdueCharges = await prisma.charge.findMany({
      where: { status: 'OVERDUE' },
      include: { tenant: { select: { id: true, name: true } } },
      take: 5,
      orderBy: { dueDate: 'asc' },
    })

    // Trials expiring in <= 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const trialsExpiring = await prisma.tenant.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lte: threeDaysFromNow, gte: now },
      },
      include: { plan: { select: { id: true, name: true } } },
      take: 5,
      orderBy: { trialEndsAt: 'asc' },
    })

    const trialsData = trialsExpiring.map(t => {
      const daysLeft = t.trialEndsAt ? Math.max(0, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0
      return {
        id: t.id,
        name: t.name,
        plan: t.plan.name,
        daysLeft,
      }
    })

    const alerts = overdueCharges.map(c => ({
      type: 'overdue' as const,
      text: `${c.tenant.name} com pagamento vencido`,
      tenantId: c.tenant.id,
    }))

    res.json({
      success: true,
      data: {
        kpis: { mrr, arr, newTenantsThisMonth, delinquentCount },
        mrrHistory,
        alerts,
        trialsExpiring: trialsData,
      },
    })
  } catch (error) {
    console.error('[Admin] getAdminDashboard error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Tenants ──

export async function getTenants(req: Request, res: Response): Promise<void> {
  try {
    const { search, status, planId, page = '1', perPage = '20' } = req.query as Record<string, string | undefined>

    const pageNum = Math.max(1, parseInt(page ?? '1'))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage ?? '20')))

    const where: Prisma.TenantWhereInput = {}

    if (status) where.status = status as 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
    if (planId) where.planId = planId

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search } },
      ]
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          plan: { select: { id: true, name: true, slug: true, priceMonthly: true } },
          _count: { select: { users: true, leads: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * perPageNum,
        take: perPageNum,
      }),
      prisma.tenant.count({ where }),
    ])

    // Stats
    const [activeCount, trialCount, suspendedCount, cancelledCount, totalTenants] = await Promise.all([
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'TRIAL' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.tenant.count({ where: { status: 'CANCELLED' } }),
      prisma.tenant.count(),
    ])

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = await prisma.tenant.count({
      where: { createdAt: { gte: startOfMonth } },
    })

    res.json({
      success: true,
      data: tenants,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
        stats: {
          total: totalTenants,
          active: activeCount,
          trial: trialCount,
          suspended: suspendedCount,
          cancelled: cancelledCount,
          newThisMonth,
        },
      },
    })
  } catch (error) {
    console.error('[Admin] getTenants error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getTenant(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
          where: { deletedAt: null },
        },
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' },
      })
      return
    }

    res.json({ success: true, data: tenant })
  } catch (error) {
    console.error('[Admin] getTenant error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateTenant(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string

    const existing = await prisma.tenant.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' },
      })
      return
    }

    const { status, planId, trialEndsAt, internalNotes, name, tradeName, email, phone } = req.body

    const data: Prisma.TenantUpdateInput = {}
    if (name !== undefined) data.name = name
    if (tradeName !== undefined) data.tradeName = tradeName
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (status !== undefined) data.status = status
    if (planId !== undefined) data.plan = { connect: { id: planId } }
    if (trialEndsAt !== undefined) data.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null
    if (internalNotes !== undefined) data.internalNotes = internalNotes

    const tenant = await prisma.tenant.update({
      where: { id },
      data,
      include: { plan: { select: { id: true, name: true, slug: true } } },
    })

    res.json({ success: true, data: tenant })
  } catch (error) {
    console.error('[Admin] updateTenant error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Financial ──

export async function getFinancial(req: Request, res: Response): Promise<void> {
  try {
    const { period = 'month', status, planId, tenantId } = req.query as Record<string, string | undefined>

    const now = new Date()

    const where: Prisma.ChargeWhereInput = {}

    if (tenantId) {
      // When filtering by tenant, ignore the period filter — show all charges for that tenant
      where.tenantId = tenantId
    } else {
      let dateFrom: Date
      if (period === 'today') {
        dateFrom = new Date()
        dateFrom.setHours(0, 0, 0, 0)
      } else if (period === 'week') {
        // Match reports.controller's getDateRange: current week
        // starting on Sunday (dayOfWeek === 0).
        const dow = now.getDay()
        dateFrom = new Date(now)
        dateFrom.setDate(now.getDate() - dow)
        dateFrom.setHours(0, 0, 0, 0)
      } else if (period === 'year') {
        dateFrom = new Date(now.getFullYear(), 0, 1)
      } else if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3) * 3
        dateFrom = new Date(now.getFullYear(), q, 1)
      } else {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      }
      where.dueDate = { gte: dateFrom }
    }

    if (status) where.status = status as 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'

    if (planId) {
      where.tenant = { planId }
    }

    const charges = await prisma.charge.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, plan: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: tenantId ? 200 : 50,
    })

    // KPIs
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const paidThisMonth = await prisma.charge.findMany({
      where: { status: 'PAID', paidAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    })
    const mrr = paidThisMonth.reduce((sum, c) => sum + Number(c.amount), 0)
    const arr = mrr * 12

    const overdueCount = await prisma.charge.count({ where: { status: 'OVERDUE' } })

    const cancelledThisMonth = await prisma.tenant.count({
      where: { status: 'CANCELLED', updatedAt: { gte: startOfMonth, lte: endOfMonth } },
    })
    const totalActive = await prisma.tenant.count({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    })
    const churnRate = totalActive > 0 ? Math.round((cancelledThisMonth / totalActive) * 1000) / 10 : 0

    const activeTenantsCount = await prisma.tenant.count({ where: { status: 'ACTIVE' } })
    const averageTicket = activeTenantsCount > 0 ? Math.round(mrr / activeTenantsCount) : 0

    res.json({
      success: true,
      data: {
        kpis: { mrr, arr, overdueCount, churnRate, averageTicket },
        charges,
      },
    })
  } catch (error) {
    console.error('[Admin] getFinancial error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
