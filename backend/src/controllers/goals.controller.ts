import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { isUserInRamping, type GoalPeriodType } from '../lib/ramping'
import {
  isValidPeriodReference,
  getMonthsInPeriod,
  type AggregationPeriod,
} from '../lib/periodReference'

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

/**
 * Retorna meta agregada pra um período composto (mensal/trimestral/
 * semestral/anual). Soma as metas mensais que compõem o período.
 *
 * Uso: dashboard/GoalsPage com filtro de período. Frontend chama esse
 * endpoint passando o tipo de agregação + periodReference. Backend
 * busca todas as Goals MONTHLY que caem nos meses cobertos e soma.
 *
 * Query: ?periodType=QUARTERLY&periodReference=2026-Q2&pipelineId=X
 */
export async function getAggregatedGoals(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { periodType, periodReference, pipelineId } = req.query as Record<string, string | undefined>

    if (!periodType || !periodReference) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'periodType e periodReference são obrigatórios' },
      })
      return
    }

    const aggType = periodType as AggregationPeriod
    if (!isValidPeriodReference(aggType, periodReference)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'periodReference inválido pro tipo informado' },
      })
      return
    }

    const months = getMonthsInPeriod(aggType, periodReference)

    // Filtro: só goals MONTHLY do tenant cujo periodReference cai nos
    // meses cobertos. Trimestrais/anuais legacy ficam fora — Alternativa A
    // assume que cadastros novos são todos mensais.
    const where: Prisma.GoalWhereInput = {
      tenantId,
      periodType: 'MONTHLY',
      periodReference: { in: months },
    }
    if (pipelineId) where.pipelineId = pipelineId

    const goals = await prisma.goal.findMany({
      where,
      include: {
        individualGoals: true,
        pipeline: { select: { id: true, name: true } },
      },
      orderBy: { periodReference: 'asc' },
    })

    // Calcula realizado de cada vendedor no intervalo. Performance ok pra
    // até ~12 meses × N vendedores; se passar, dá pra otimizar com
    // groupBy depois.
    if (goals.length === 0) {
      res.json({
        success: true,
        data: {
          periodType: aggType,
          periodReference,
          months,
          totalRevenueGoal: 0,
          totalDealsGoal: 0,
          totalRevenueCurrent: 0,
          monthlyGoals: [],
          userGoalsAggregated: [],
        },
      })
      return
    }

    // Soma totais
    const totalRevenueGoal = goals.reduce((s, g) =>
      s + (g.totalRevenueGoal ? Number(g.totalRevenueGoal) : 0), 0,
    )
    const totalDealsGoal = goals.reduce((s, g) =>
      s + (g.totalDealsGoal ?? 0), 0,
    )

    // Janela temporal pra calcular realizado: do dia 1 do primeiro mês
    // até o último dia do último mês cobertos pelo período.
    const firstMonth = months[0]!
    const lastMonth = months[months.length - 1]!
    const [fy, fm] = firstMonth.split('-').map(n => parseInt(n!, 10))
    const [ly, lm] = lastMonth.split('-').map(n => parseInt(n!, 10))
    const startDate = new Date(fy!, (fm! - 1), 1)
    const endDate = new Date(ly!, lm!, 0, 23, 59, 59, 999)

    // Agrega individuais por user — soma revenueGoal e dealsGoal de cada
    // vendedor ao longo dos meses; isRamping é true se em ALGUM mês ele
    // estava rampante (info pra UI).
    const userAgg = new Map<string, {
      userId: string
      revenueGoal: number
      dealsGoal: number
      isRampingAnyMonth: boolean
    }>()

    for (const goal of goals) {
      for (const ig of goal.individualGoals) {
        const cur = userAgg.get(ig.userId) ?? {
          userId: ig.userId,
          revenueGoal: 0,
          dealsGoal: 0,
          isRampingAnyMonth: false,
        }
        cur.revenueGoal += ig.revenueGoal ? Number(ig.revenueGoal) : 0
        cur.dealsGoal += ig.dealsGoal ?? 0
        if (ig.isRamping) cur.isRampingAnyMonth = true
        userAgg.set(ig.userId, cur)
      }
    }

    // Calcula realizado do intervalo pra cada user agregado + busca nome
    const userIds = Array.from(userAgg.keys())
    const [users, wonLeads] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      prisma.lead.findMany({
        where: {
          tenantId,
          responsibleId: { in: userIds },
          status: 'WON',
          wonAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        select: { responsibleId: true, closedValue: true },
      }),
    ])
    const userById = new Map(users.map(u => [u.id, u.name]))
    const currentByUser = new Map<string, number>()
    for (const lead of wonLeads) {
      const cur = currentByUser.get(lead.responsibleId) ?? 0
      currentByUser.set(lead.responsibleId, cur + (lead.closedValue ? Number(lead.closedValue) : 0))
    }

    const userGoalsAggregated = Array.from(userAgg.values()).map(agg => {
      const current = currentByUser.get(agg.userId) ?? 0
      const percentage = agg.revenueGoal > 0
        ? Math.round((current / agg.revenueGoal) * 1000) / 10
        : 0
      return {
        userId: agg.userId,
        user: { id: agg.userId, name: userById.get(agg.userId) ?? 'Desconhecido' },
        revenueGoal: agg.revenueGoal,
        dealsGoal: agg.dealsGoal,
        isRamping: agg.isRampingAnyMonth,
        current,
        percentage,
      }
    })

    const totalRevenueCurrent = Array.from(currentByUser.values()).reduce((s, v) => s + v, 0)

    res.json({
      success: true,
      data: {
        periodType: aggType,
        periodReference,
        months,
        totalRevenueGoal,
        totalDealsGoal,
        totalRevenueCurrent,
        monthlyGoals: goals.map(g => ({
          id: g.id,
          periodReference: g.periodReference,
          totalRevenueGoal: g.totalRevenueGoal ? Number(g.totalRevenueGoal) : 0,
          totalDealsGoal: g.totalDealsGoal,
        })),
        userGoalsAggregated: userGoalsAggregated.sort((a, b) => b.percentage - a.percentage),
      },
    })
  } catch (error) {
    console.error('[Goals] getAggregatedGoals error:', error)
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

    // Validação de formato — Bug 5 introduziu cadastro mensal selecionado.
    // Backend continua aceitando QUARTERLY/YEARLY pra compat com metas
    // legacy, mas exige formato correto pra cada tipo.
    if (!isValidPeriodReference(periodType as AggregationPeriod, periodReference)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `periodReference inválido pro tipo ${periodType}. Esperado: MONTHLY=YYYY-MM, QUARTERLY=YYYY-Q[1-4], YEARLY=YYYY.`,
        },
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

    let individualGoalsData: { tenantId: string; userId: string; revenueGoal: Prisma.Decimal | null; dealsGoal: number | null; isRamping: boolean }[] = []

    if (distributionType === 'INDIVIDUAL' && Array.isArray(userGoals)) {
      // Distribuição manual: rampagem NÃO se aplica (gestor define valor
      // por vendedor explicitamente). Doc seção 6.9: rampagem é regra
      // automática só de distribuição GENERAL.
      individualGoalsData = (userGoals as { userId: string; revenueGoal?: number; dealsGoal?: number }[]).map((ug) => ({
        tenantId,
        userId: ug.userId,
        revenueGoal: ug.revenueGoal ? new Prisma.Decimal(ug.revenueGoal) : null,
        dealsGoal: ug.dealsGoal ?? null,
        isRamping: false,
      }))
    } else {
      // GENERAL: distribui igualmente entre vendedores ATIVOS, excluindo
      // os que estão em rampagem para esse período. Rampantes entram com
      // isRamping=true e sem meta — visualmente aparecem no painel mas
      // não contam pra divisão (regra do Documento de Requisitos 6.3).
      const users = await prisma.user.findMany({
        where: { tenantId, role: { in: ['SELLER', 'TEAM_LEADER'] }, isActive: true, deletedAt: null },
        select: { id: true, rampingStartsAt: true },
      })

      const goalPeriodType = periodType as GoalPeriodType

      const rampingUsers = users.filter(u => isUserInRamping(u.rampingStartsAt, goalPeriodType, periodReference))
      const activeUsers = users.filter(u => !isUserInRamping(u.rampingStartsAt, goalPeriodType, periodReference))

      if (activeUsers.length > 0) {
        const revenuePerUser = totalRevenueGoal ? Math.round(Number(totalRevenueGoal) / activeUsers.length) : null
        const dealsPerUser = totalDealsGoal ? Math.round(Number(totalDealsGoal) / activeUsers.length) : null

        individualGoalsData = activeUsers.map((u) => ({
          tenantId,
          userId: u.id,
          revenueGoal: revenuePerUser ? new Prisma.Decimal(revenuePerUser) : null,
          dealsGoal: dealsPerUser,
          isRamping: false,
        }))
      }

      // Rampantes registrados como GoalIndividual.isRamping=true, sem meta.
      // Permite GoalsPage mostrar badge "Em rampagem — não conta na divisão"
      // sem precisar de query separada e mantém histórico de quem estava
      // rampando em cada período.
      const rampingGoalsData = rampingUsers.map((u) => ({
        tenantId,
        userId: u.id,
        revenueGoal: null,
        dealsGoal: null,
        isRamping: true,
      }))
      individualGoalsData = [...individualGoalsData, ...rampingGoalsData]
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

// ── Edição de GoalIndividual em meta existente (Bug 5 Fase B) ──
//
// Decisão de produto: ao incluir/editar valor de um vendedor numa meta
// já criada, o delta SOMA em Goal.totalRevenueGoal (não reduz dos
// demais). Ex: meta de R$ 100k entre 5 vendedores → adicionar X com
// R$ 15k → meta total vira R$ 115k. Os outros 5 não são tocados.
//
// Casos cobertos:
//   - Vendedor não está na meta + revenueGoal > 0 → cria GoalIndividual + soma
//   - Vendedor já está + revenueGoal mudou → atualiza + soma o delta
//   - revenueGoal = 0 → marca como 0 (efetivamente "remove" da divisão);
//     totalRevenueGoal diminui pelo valor que estava antes

export async function upsertGoalIndividual(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const goalId = req.params.goalId as string
    const userId = req.params.userId as string
    const { revenueGoal, dealsGoal } = req.body as { revenueGoal?: number; dealsGoal?: number }

    if (revenueGoal === undefined || typeof revenueGoal !== 'number' || revenueGoal < 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'revenueGoal (number >= 0) é obrigatório' },
      })
      return
    }

    const goal = await prisma.goal.findFirst({ where: { id: goalId, tenantId } })
    if (!goal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Meta não encontrada' } })
      return
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' } })
      return
    }

    const existing = await prisma.goalIndividual.findFirst({ where: { goalId, userId } })
    const oldValue = existing?.revenueGoal ? Number(existing.revenueGoal) : 0
    const delta = revenueGoal - oldValue

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.goalIndividual.update({
          where: { id: existing.id },
          data: {
            revenueGoal: revenueGoal > 0 ? new Prisma.Decimal(revenueGoal) : null,
            dealsGoal: dealsGoal ?? existing.dealsGoal,
            // Quem entra com valor explícito sai de rampagem nessa meta —
            // gestor está dizendo "esse vendedor conta agora".
            isRamping: revenueGoal > 0 ? false : existing.isRamping,
          },
        })
      } else {
        await tx.goalIndividual.create({
          data: {
            tenantId,
            goalId,
            userId,
            revenueGoal: revenueGoal > 0 ? new Prisma.Decimal(revenueGoal) : null,
            dealsGoal: dealsGoal ?? null,
            isRamping: false,
          },
        })
      }

      // Ajusta totalRevenueGoal pelo delta (soma na meta total).
      if (delta !== 0) {
        const currentTotal = goal.totalRevenueGoal ? Number(goal.totalRevenueGoal) : 0
        const newTotal = Math.max(0, currentTotal + delta)
        await tx.goal.update({
          where: { id: goalId },
          data: { totalRevenueGoal: new Prisma.Decimal(newTotal) },
        })
      }
    })

    const updated = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { individualGoals: true, pipeline: { select: { id: true, name: true } } },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('[Goals] upsertGoalIndividual error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Inclusão de vendedor novo em metas ativas (Bug 5 Fase C — backend) ──
//
// Frontend chama esse endpoint depois de criar um vendedor pra perguntar
// como ele entra nas metas mensais ativas. 3 modos:
//   - 'distribute': valor médio das metas ativas (totalRevenueGoal /
//     vendedores ativos não-rampantes) entra como meta dele. Rampagem
//     respeitada por meta — se ele está rampante naquele mês, isRamping
//     é true e revenueGoal é null. Soma na meta total.
//   - 'manual': gestor passa { goalId: revenueGoal } em manualValues.
//     Cada par vira upsert. Soma na meta total.
//   - 'skip': nada. Retorna lista de metas ativas pra registro.
//
// "Metas ativas" = MONTHLY com periodReference >= mês corrente.

export async function includeUserInActiveGoals(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.params.id as string
    const { mode, manualValues } = req.body as {
      mode?: 'distribute' | 'manual' | 'skip'
      manualValues?: Record<string, number>
    }

    if (mode !== 'distribute' && mode !== 'manual' && mode !== 'skip') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: "mode deve ser 'distribute', 'manual' ou 'skip'" },
      })
      return
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true, rampingStartsAt: true },
    })
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado' } })
      return
    }

    // Metas mensais ativas (mês corrente em diante)
    const now = new Date()
    const currentRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const activeGoals = await prisma.goal.findMany({
      where: {
        tenantId,
        periodType: 'MONTHLY',
        periodReference: { gte: currentRef },
      },
      include: { individualGoals: true },
      orderBy: { periodReference: 'asc' },
    })

    if (activeGoals.length === 0 || mode === 'skip') {
      res.json({
        success: true,
        data: { activeGoalsCount: activeGoals.length, applied: [] },
      })
      return
    }

    const applied: Array<{ goalId: string; periodReference: string; addedValue: number; isRamping: boolean }> = []

    await prisma.$transaction(async (tx) => {
      for (const goal of activeGoals) {
        // Já está na meta? Skip — evita double-add.
        const existing = goal.individualGoals.find(g => g.userId === userId)
        if (existing) continue

        const ramping = isUserInRamping(user.rampingStartsAt, 'MONTHLY', goal.periodReference)

        let revenueGoalForUser = 0
        if (mode === 'distribute') {
          if (ramping) {
            // Rampante entra com isRamping=true e sem meta. Não soma na total.
            await tx.goalIndividual.create({
              data: {
                tenantId,
                goalId: goal.id,
                userId,
                revenueGoal: null,
                dealsGoal: null,
                isRamping: true,
              },
            })
            applied.push({ goalId: goal.id, periodReference: goal.periodReference, addedValue: 0, isRamping: true })
            continue
          }
          // Calcula valor médio: totalRevenueGoal / nº de não-rampantes existentes
          const nonRamping = goal.individualGoals.filter(g => !g.isRamping).length || 1
          const total = goal.totalRevenueGoal ? Number(goal.totalRevenueGoal) : 0
          revenueGoalForUser = Math.round(total / nonRamping)
        } else {
          // mode === 'manual'
          const v = manualValues?.[goal.id]
          if (typeof v !== 'number' || v < 0) continue
          revenueGoalForUser = v
        }

        if (revenueGoalForUser <= 0) continue

        await tx.goalIndividual.create({
          data: {
            tenantId,
            goalId: goal.id,
            userId,
            revenueGoal: new Prisma.Decimal(revenueGoalForUser),
            dealsGoal: null,
            isRamping: false,
          },
        })

        // Soma na meta total da equipe (decisão de produto Bug 5).
        const currentTotal = goal.totalRevenueGoal ? Number(goal.totalRevenueGoal) : 0
        await tx.goal.update({
          where: { id: goal.id },
          data: { totalRevenueGoal: new Prisma.Decimal(currentTotal + revenueGoalForUser) },
        })

        applied.push({ goalId: goal.id, periodReference: goal.periodReference, addedValue: revenueGoalForUser, isRamping: false })
      }
    })

    res.json({
      success: true,
      data: {
        activeGoalsCount: activeGoals.length,
        applied,
      },
    })
  } catch (error) {
    console.error('[Goals] includeUserInActiveGoals error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// Endpoint utilitário pra Fase C: lista metas mensais ativas (>= mês
// corrente) pra montar o modal de "incluir vendedor novo". Retorna info
// suficiente pro modal mostrar valor sugerido em modo distribute.
export async function getActiveMonthlyGoals(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const now = new Date()
    const currentRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const goals = await prisma.goal.findMany({
      where: {
        tenantId,
        periodType: 'MONTHLY',
        periodReference: { gte: currentRef },
      },
      include: { individualGoals: true, pipeline: { select: { id: true, name: true } } },
      orderBy: { periodReference: 'asc' },
    })
    const enriched = goals.map(g => {
      const nonRamping = g.individualGoals.filter(ig => !ig.isRamping).length || 1
      const total = g.totalRevenueGoal ? Number(g.totalRevenueGoal) : 0
      return {
        id: g.id,
        periodReference: g.periodReference,
        pipeline: g.pipeline,
        totalRevenueGoal: total,
        suggestedValue: Math.round(total / nonRamping),
        currentSellersCount: nonRamping,
      }
    })
    res.json({ success: true, data: enriched })
  } catch (error) {
    console.error('[Goals] getActiveMonthlyGoals error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
