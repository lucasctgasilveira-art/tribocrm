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

export async function createGoal(payload: CreateGoalPayload) {
  const response = await api.post('/goals', payload)
  return response.data.data
}

export async function updateGoal(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/goals/${id}`, payload)
  return response.data.data
}

export default { getGoals, getGoalDashboard, createGoal, updateGoal }
