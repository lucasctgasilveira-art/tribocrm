import api from './api'

export interface CreateFormPayload {
  name: string
  pipelineId: string
  stageId: string
  distributionType?: string
  automationId?: string
  fieldsConfig?: { label: string; type: string; required: boolean }[]
  successRedirectUrl?: string | null
  successMessage?: string | null
}

export async function getForms() {
  const response = await api.get('/forms')
  return response.data.data
}

export async function getFormStats() {
  const response = await api.get('/forms/stats')
  return response.data.data
}

export async function createForm(payload: CreateFormPayload) {
  const response = await api.post('/forms', payload)
  return response.data.data
}

export async function updateForm(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/forms/${id}`, payload)
  return response.data.data
}

export async function deleteForm(id: string) {
  const response = await api.delete(`/forms/${id}`)
  return response.data.data
}

export default { getForms, getFormStats, createForm, updateForm, deleteForm }
