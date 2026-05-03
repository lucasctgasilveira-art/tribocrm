import api from './api'

export interface TenantsParams {
  search?: string
  status?: string
  planId?: string
  page?: number
  perPage?: number
}

export async function getAdminDashboard(params?: { period?: string; startDate?: string; endDate?: string }) {
  const response = await api.get('/admin/dashboard', { params })
  return response.data.data
}

// ── Dashboard consolidado de leads (Super Admin) ──

export type ClientFilter = 'all' | 'active' | 'inactive'
export type SellerFilter = 'all' | 'active' | 'inactive'
export type LeadFilter = 'all' | 'active' | 'inactive' | 'archived'

export interface LeadsOverviewFilters {
  tenantId?: string
  clientStatus?: ClientFilter
  sellerStatus?: SellerFilter
  leadStatus?: LeadFilter
  periodType: 'MONTHLY' | 'QUARTERLY' | 'SEMESTRAL' | 'YEARLY'
  periodReference: string
}

export interface LeadsOverviewData {
  filters: LeadsOverviewFilters
  clients: { active: number; inactive: number }
  sellers: { active: number; inactive: number }
  leads: { active: number; won: number; lost: number; archived: number }
  revenue: { inNegotiation: number; finalized: number }
}

export async function getLeadsOverview(filters: LeadsOverviewFilters): Promise<LeadsOverviewData> {
  const response = await api.get('/admin/leads-overview', { params: filters })
  return response.data.data
}

export interface AdminTenantOption { id: string; name: string; status: string }
export async function getTenantsForFilter(): Promise<AdminTenantOption[]> {
  const response = await api.get('/admin/tenants-for-filter')
  return response.data.data
}

/**
 * Dispara download de CSV. Não retorna data — força navigator a baixar
 * o arquivo. Usa o accessToken do localStorage no Authorization header
 * via fetch direto (axios com responseType=blob também serviria).
 */
export async function exportLeadsCsv(filters: LeadsOverviewFilters): Promise<void> {
  const response = await api.get('/admin/leads-export', {
    params: filters,
    responseType: 'blob',
  })
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${filters.periodReference}-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
