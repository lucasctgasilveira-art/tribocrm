import api from './api'

export interface UsersParams {
  search?: string
  role?: string
  teamId?: string
  isActive?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password?: string
  role: string
  cpf?: string
  birthday?: string
  teamId?: string
  pipelineIds?: string[]
  // Mês a partir do qual o vendedor entra na divisão de metas (rampagem).
  // Formato "YYYY-MM" — backend converte pra Date no 1º dia do mês.
  // Vazio/undefined = participa de tudo (sem rampagem).
  rampingStartsAt?: string
}

export interface CreateUserResult {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  tempPassword?: string
  emailSent: boolean
}

export interface CreateTeamPayload {
  name: string
  leaderId?: string
  memberIds?: string[]
}

export async function getUsers(params?: UsersParams) {
  const response = await api.get('/users', { params })
  return response.data.data
}

export async function getAdminTeam(): Promise<{ id: string; name: string }[]> {
  const response = await api.get('/admin/team')
  return (response.data?.data ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
}

export async function createUser(payload: CreateUserPayload): Promise<CreateUserResult> {
  const response = await api.post('/users', payload)
  return response.data.data
}

export async function updateUser(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/users/${id}`, payload)
  return response.data.data
}

export async function resetUserPassword(id: string, newPassword: string) {
  const response = await api.patch(`/users/${id}/reset-password`, { newPassword })
  return response.data.data
}

export async function getTeams() {
  const response = await api.get('/teams')
  return response.data.data
}

export async function createTeam(payload: CreateTeamPayload) {
  const response = await api.post('/teams', payload)
  return response.data.data
}

export async function updateTeam(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/teams/${id}`, payload)
  return response.data.data
}

// Pipeline access por usuario.
export interface UserPipelineAccessResult {
  pipelineIds: string[]
  isOwner: boolean
}

export async function getUserPipelines(userId: string): Promise<UserPipelineAccessResult> {
  const response = await api.get(`/users/${userId}/pipelines`)
  return response.data.data
}

export async function setUserPipelines(userId: string, pipelineIds: string[]): Promise<UserPipelineAccessResult> {
  const response = await api.put(`/users/${userId}/pipelines`, { pipelineIds })
  return response.data.data
}

export default { getUsers, createUser, updateUser, resetUserPassword, getTeams, createTeam, updateTeam, getUserPipelines, setUserPipelines }
