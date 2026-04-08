import api from './api'

export interface TenantsParams {
  search?: string
  status?: string
  planId?: string
  page?: number
  perPage?: number
}

export async function getAdminDashboard() {
  const response = await api.get('/admin/dashboard')
  return response.data.data
}

export async function getTenants(params?: TenantsParams) {
  const response = await api.get('/admin/tenants', { params })
  return { data: response.data.data, meta: response.data.meta }
}

export async function getTenant(id: string) {
  const response = await api.get(`/admin/tenants/${id}`)
  return response.data.data
}

export async function updateTenant(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/admin/tenants/${id}`, payload)
  return response.data.data
}

export async function getFinancial(params?: { period?: string; status?: string; planId?: string; tenantId?: string }) {
  const response = await api.get('/admin/financial', { params })
  return response.data.data
}

export async function updateCharge(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/admin/charges/${id}`, payload)
  return response.data.data
}

export default { getAdminDashboard, getTenants, getTenant, updateTenant, getFinancial, updateCharge }
