import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getGoals, getGoalDashboard, createGoal, updateGoal, getAggregatedGoals,
  upsertGoalIndividual, getActiveMonthlyGoals,
} from '../controllers/goals.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/', getGoals)
router.get('/dashboard', getGoalDashboard)
// Agregação por período composto (Bug 5 — Alternativa A). Soma metas
// mensais que compõem o período. Usado pra filtros Tri/Sem/Ano em
// GoalsPage e Dashboard.
router.get('/aggregated', getAggregatedGoals)
router.post('/', createGoal)
router.patch('/:id', updateGoal)

// Bug 5 Fase B — edição de GoalIndividual em meta existente.
// PATCH cria/atualiza/zera; ajusta totalRevenueGoal pelo delta (soma).
router.patch('/:goalId/individual/:userId', upsertGoalIndividual)

// Bug 5 Fase C — utilitários pra "incluir vendedor novo em metas ativas".
// GET lista metas ativas (>= mês corrente) com valor sugerido pra distribute.
// O endpoint POST /users/:id/include-in-active-goals fica em users.routes.ts
// pra ficar próximo do CRUD de usuários (UX faz mais sentido lá).
router.get('/active-monthly', getActiveMonthlyGoals)

export default router
