import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export async function getGoals(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { periodType, year } = req.query as Record<string, string | undefined>

    const where: Prisma.GoalWhereInput = { tenantId }

    if (periodType) where.periodType = periodType as 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
    if (year) where.periodReference = { startsWith: year }

    const goals = await prisma.goal.findMany({
      where,
      include: {
        individualGoals: {
          include: {
            goal: false,
          },
        },
        pipeline: { select: { id: true, name: true } },
      },
      orderBy: { periodReference: 'desc' },
    })

    // Enrich individual goals with user names
    const enriched = await Promise.all(
      goals.map(async (goal) => {
        const userGoals = await Promise.all(
          goal.individualGoals.map(async (ig) => {
            const user = await prisma.user.findUnique({
              where: { id: ig.userId },
              select: { id: true, name: true },
            })
            return { ...ig, user: user ?? { id: ig.userId, name: 'Desconhecido' } }
          })
        )
        return { ...goal, individualGoals: userGoals }
      })
    )

    res.json({ success: true, data: enriched })
  } catch (error) {
    console.error('[Goals] getGoals error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function getGoalDashboard(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId

    const now = new Date()
    const periodRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const goal = await prisma.goal.findFirst({
      where: { tenantId, periodType: 'MONTHLY', periodReference: periodRef },
      include: {
        individualGoals: true,
        pipeline: { select: { id: true, name: true } },
      },
    })

    if (!goal) {
      res.json({ success: true, data: { goal: null, userGoals: [] } })
      return
    }

    const totalTarget = goal.totalRevenueGoal ? Number(goal.totalRevenueGoal) : 0

    // Calculate current revenue for each user goal
    const userGoals = await Promise.all(
      goal.individualGoals.map(async (ig) => {
        const user = await prisma.user.findUnique({
          where: { id: ig.userId },
          select: { id: true, name: true },
        })

        const wonLeads = await prisma.lead.findMany({
          where: {
            tenantId,
            responsibleId: ig.userId,
            status: 'WON',
            wonAt: { gte: startOfMonth, lte: endOfMonth },
            deletedAt: null,
          },
          select: { closedValue: true },
        })

        const current = wonLeads.reduce(
          (sum, l) => sum + (l.closedValue ? Number(l.closedValue) : 0), 0
        )
        const target = ig.revenueGoal ? Number(ig.revenueGoal) : 0
        const percentage = target > 0 ? Math.round((current / target) * 1000) / 10 : 0

        return {
          id: ig.id,
          userId: ig.userId,
          user: user ?? { id: ig.userId, name: 'Desconhecido' },
          revenueGoal: target,
          dealsGoal: ig.dealsGoal,
          isRamping: ig.isRamping,
          current,
          percentage,
        }
      })
    )

    // Calculate total current
    const totalCurrent = userGoals.reduce((sum, ug) => sum + ug.current, 0)
    const totalPercentage = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 1000) / 10 : 0

    // Days remaining in month
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = lastDay - now.getDate()

    res.json({
      success: true,
      data: {
        goal: {
          id: goal.id,
          periodType: goal.periodType,
          periodReference: goal.periodReference,
          goalType: goal.goalType,
          totalRevenueGoal: totalTarget,
          totalDealsGoal: goal.totalDealsGoal,
          distributionType: goal.distributionType,
          pipeline: goal.pipeline,
          totalCurrent,
          totalPercentage,
          daysRemaining,
        },
        userGoals: userGoals.sort((a, b) => b.percentage - a.percentage),
      },
    })
  } catch (error) {
    console.error('[Goals] getGoalDashboard error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createGoal(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId

    const {
      periodType = 'MONTHLY',
      periodReference,
      pipelineId,
      goalType = 'REVENUE',
      totalRevenueGoal,
      totalDealsGoal,
      distributionType = 'GENERAL',
      userGoals,
    } = req.body

    if (!periodReference || !pipelineId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'periodReference e pipelineId são obrigatórios' },
      })
      return
    }

    // Check if goal already exists for this period
    const existing = await prisma.goal.findFirst({
      where: { tenantId, periodType, periodReference, pipelineId },
    })

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Já existe uma meta para este período e pipeline' },
      })
      return
    }

    let individualGoalsData: { tenantId: string; userId: string; revenueGoal: Prisma.Decimal | null; dealsGoal: number | null }[] = []

    if (distributionType === 'INDIVIDUAL' && Array.isArray(userGoals)) {
      individualGoalsData = (userGoals as { userId: string; revenueGoal?: number; dealsGoal?: number }[]).map((ug) => ({
        tenantId,
        userId: ug.userId,
        revenueGoal: ug.revenueGoal ? new Prisma.Decimal(ug.revenueGoal) : null,
        dealsGoal: ug.dealsGoal ?? null,
      }))
    } else {
      // GENERAL: distribute equally among active sellers
      const users = await prisma.user.findMany({
        where: { tenantId, role: { in: ['SELLER', 'TEAM_LEADER'] }, isActive: true, deletedAt: null },
        select: { id: true },
      })

      if (users.length > 0) {
        const revenuePerUser = totalRevenueGoal ? Math.round(Number(totalRevenueGoal) / users.length) : null
        const dealsPerUser = totalDealsGoal ? Math.round(Number(totalDealsGoal) / users.length) : null

        individualGoalsData = users.map((u) => ({
          tenantId,
          userId: u.id,
          revenueGoal: revenuePerUser ? new Prisma.Decimal(revenuePerUser) : null,
          dealsGoal: dealsPerUser,
        }))
      }
    }

    const goal = await prisma.goal.create({
      data: {
        tenantId,
        pipelineId,
        periodType: periodType as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
        periodReference,
        goalType: goalType as 'REVENUE' | 'DEALS' | 'BOTH',
        totalRevenueGoal: totalRevenueGoal ? new Prisma.Decimal(totalRevenueGoal) : null,
        totalDealsGoal: totalDealsGoal ?? null,
        distributionType: distributionType as 'GENERAL' | 'INDIVIDUAL',
        createdBy: userId,
        individualGoals: {
          create: individualGoalsData,
        },
      },
      include: {
        individualGoals: true,
        pipeline: { select: { id: true, name: true } },
      },
    })

    res.status(201).json({ success: true, data: goal })
  } catch (error) {
    console.error('[Goals] createGoal error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateGoal(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.goal.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meta não encontrada' },
      })
      return
    }

    const { totalRevenueGoal, totalDealsGoal, userGoals } = req.body

    const data: Prisma.GoalUpdateInput = {}
    if (totalRevenueGoal !== undefined) data.totalRevenueGoal = new Prisma.Decimal(totalRevenueGoal)
    if (totalDealsGoal !== undefined) data.totalDealsGoal = totalDealsGoal

    await prisma.goal.update({ where: { id }, data })

    if (Array.isArray(userGoals)) {
      await prisma.goalIndividual.deleteMany({ where: { goalId: id } })
      if (userGoals.length > 0) {
        await prisma.goalIndividual.createMany({
          data: (userGoals as { userId: string; revenueGoal?: number; dealsGoal?: number }[]).map((ug) => ({
            tenantId,
            goalId: id,
            userId: ug.userId,
            revenueGoal: ug.revenueGoal ? new Prisma.Decimal(ug.revenueGoal) : null,
            dealsGoal: ug.dealsGoal ?? null,
          })),
        })
      }
    }

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        individualGoals: true,
        pipeline: { select: { id: true, name: true } },
      },
    })

    res.json({ success: true, data: goal })
  } catch (error) {
    console.error('[Goals] updateGoal error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
