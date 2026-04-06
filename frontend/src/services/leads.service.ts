import api from './api'

export interface LeadsParams {
  pipelineId?: string
  stageId?: string
  status?: string
  temperature?: string
  search?: string
  page?: number
  perPage?: number
}

export interface LeadPayload {
  name: string
  company?: string
  email?: string
  phone?: string
  whatsapp?: string
  expectedValue?: number
  stageId: string
  pipelineId: string
  temperature?: string
}

export async function getLeads(params?: LeadsParams) {
  const response = await api.get('/leads', { params })
  return {
    data: response.data.data ?? [],
    meta: response.data.meta ?? { total: 0, page: 1, perPage: 20, totalPages: 0 },
  }
}

export async function getLead(id: string) {
  const response = await api.get(`/leads/${id}`)
  return response.data.data ?? null
}

export async function createLead(payload: LeadPayload) {
  const response = await api.post('/leads', payload)
  return response.data.data
}

export async function updateLead(id: string, payload: Partial<LeadPayload>) {
  const response = await api.patch(`/leads/${id}`, payload)
  return response.data.data
}

export async function deleteLead(id: string) {
  const response = await api.delete(`/leads/${id}`)
  return response.data.data
}

export default { getLeads, getLead, createLead, updateLead, deleteLead }
