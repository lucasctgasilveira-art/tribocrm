import api from './api'

export interface GoalsParams {
  periodType?: string
  year?: string
}

export interface CreateGoalPayload {
  periodType?: string
  periodReference: string
  pipelineId: string
  goalType?: string
  totalRevenueGoal?: number
  totalDealsGoal?: number
  distributionType?: string
  userGoals?: { userId: string; revenueGoal?: number; dealsGoal?: number }[]
}

export async function getGoals(params?: GoalsParams) {
  const response = await api.get('/goals', { params })
  return response.data.data
}

export async function getGoalDashboard() {
  const response = await api.get('/goals/dashboard')
  return response.data.data
}

// Bug 5 Fase A1 — agregação por período composto.
// Soma metas mensais que compõem o período (Q2 = abr+mai+jun, etc.).
export interface AggregatedGoals {
  periodType: 'MONTHLY' | 'QUARTERLY' | 'SEMESTRAL' | 'YEARLY'
  periodReference: string
  months: string[]
  totalRevenueGoal: number
  totalDealsGoal: number
  totalRevenueCurrent: number
  monthlyGoals: Array<{ id: string; periodReference: string; totalRevenueGoal: number; totalDealsGoal: number | null }>
  userGoalsAggregated: Array<{
    userId: string
    user: { id: string; name: string }
    revenueGoal: number
    dealsGoal: number
    isRamping: boolean
    current: number
    percentage: number
  }>
}

export async function getAggregatedGoals(params: {
  periodType: 'MONTHLY' | 'QUARTERLY' | 'SEMESTRAL' | 'YEARLY'
  periodReference: string
  pipelineId?: string
}): Promise<AggregatedGoals> {
  const response = await api.get('/goals/aggregated', { params })
  return response.data.data
}

export async function createGoal(payload: CreateGoalPayload) {
  const response = await api.post('/goals', payload)
  return response.data.data
}

export async function updateGoal(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/goals/${id}`, payload)
  return response.data.data
}

export default { getGoals, getGoalDashboard, createGoal, updateGoal }
