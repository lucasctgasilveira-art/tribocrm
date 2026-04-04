import api from './api'

export interface CreateAutomationPayload {
  name: string
  pipelineId?: string
  triggerType: string
  triggerConfig?: Record<string, unknown>
  actionType: string
  actionConfig?: Record<string, unknown>
}

export async function getAutomations() {
  const response = await api.get('/automations')
  return { data: response.data.data, meta: response.data.meta }
}

export async function createAutomation(payload: CreateAutomationPayload) {
  const response = await api.post('/automations', payload)
  return response.data.data
}

export async function updateAutomation(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/automations/${id}`, payload)
  return response.data.data
}

export async function deleteAutomation(id: string) {
  const response = await api.delete(`/automations/${id}`)
  return response.data.data
}

export async function getAutomationLogs(id: string) {
  const response = await api.get(`/automations/${id}/logs`)
  return response.data.data
}

export default { getAutomations, createAutomation, updateAutomation, deleteAutomation, getAutomationLogs }
