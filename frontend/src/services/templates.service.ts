import api from './api'

// ── Email Templates ──

export async function getEmailTemplates(params?: { search?: string; isActive?: string }) {
  const response = await api.get('/templates/email', { params })
  return response.data.data
}

export async function createEmailTemplate(payload: { name: string; subject: string; body: string }) {
  const response = await api.post('/templates/email', payload)
  return response.data.data
}

export async function updateEmailTemplate(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/templates/email/${id}`, payload)
  return response.data.data
}

export async function deleteEmailTemplate(id: string) {
  const response = await api.delete(`/templates/email/${id}`)
  return response.data.data
}

// ── WhatsApp Templates ──

export async function getWhatsappTemplates(params?: { search?: string; isActive?: string }) {
  const response = await api.get('/templates/whatsapp', { params })
  return response.data.data
}

export async function createWhatsappTemplate(payload: { name: string; body: string }) {
  const response = await api.post('/templates/whatsapp', payload)
  return response.data.data
}

export async function updateWhatsappTemplate(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/templates/whatsapp/${id}`, payload)
  return response.data.data
}

export async function deleteWhatsappTemplate(id: string) {
  const response = await api.delete(`/templates/whatsapp/${id}`)
  return response.data.data
}

export default {
  getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  getWhatsappTemplates, createWhatsappTemplate, updateWhatsappTemplate, deleteWhatsappTemplate,
}
