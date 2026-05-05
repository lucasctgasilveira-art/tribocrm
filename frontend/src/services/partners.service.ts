import api from './api'

// Service de gestão de parceiros (afiliados). Frontend Super Admin
// usa CRUD; frontend gestor usa endpoints separados em /tenant-partner.

// Faixa de comissão progressiva. maxClients=null = "acima do tier anterior".
export interface CommissionTier {
  maxClients: number | null
  rate: number
}

// Defaults sugeridos no modal (Lucas pode editar antes de salvar).
export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { maxClients: 5, rate: 15 },
  { maxClients: 19, rate: 20 },
  { maxClients: null, rate: 25 },
]

// Calcula a faixa aplicável agora baseado em quantidade de clientes
// ativos do parceiro. Espelha a lógica do backend pra UI mostrar
// "está aplicando 20%" sem ida ao servidor.
export function applyTier(tiers: CommissionTier[], activeCount: number): number | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null
  for (const tier of tiers) {
    if (tier.maxClients === null) return tier.rate
    if (activeCount <= tier.maxClients) return tier.rate
  }
  return tiers[tiers.length - 1]?.rate ?? null
}

export interface PartnerListItem {
  id: string
  name: string
  email: string
  document: string | null
  code: string
  commissionRate: number | null
  commissionTiers: CommissionTier[]
  activeClientsCount: number
  isActive: boolean
  createdAt: string
  _count: { referredTenants: number; commissions: number }
  totals: { pending: number; available: number; paid: number }
}

export interface PartnerDetail {
  id: string
  name: string
  email: string
  document: string | null
  phone: string | null
  pixKey: string | null
  bankName: string | null
  bankBranch: string | null
  bankAccount: string | null
  bankAccountType: string | null
  bankInfo: string | null
  code: string
  commissionRate: number | null
  commissionTiers: CommissionTier[]
  activeClientsCount: number
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  referredTenants: Array<{
    id: string
    name: string
    email: string
    status: string
    referredAt: string | null
    createdAt: string
  }>
  commissions: Array<PartnerCommissionItem>
}

export interface PartnerCommissionItem {
  id: string
  chargeId: string
  tenant: { id: string; name: string } | null
  amount: number
  rate: number
  commission: number
  status: 'PENDING' | 'AVAILABLE' | 'PAID' | 'REVERSED'
  availableAt: string
  paidAt: string | null
  notes: string | null
  createdAt: string
}

export interface CommissionsReportData {
  month: string
  groups: Array<{
    partner: { id: string; name: string; code: string; pixKey: string | null; bankInfo: string | null; document: string | null }
    commissions: PartnerCommissionItem[]
    totalCommission: number
    totalAmount: number
  }>
  totals: {
    totalCommission: number
    partnerCount: number
    commissionCount: number
  }
}

export interface CreatePartnerInput {
  name: string
  email: string
  document?: string
  phone?: string
  pixKey?: string
  bankName?: string
  bankBranch?: string
  bankAccount?: string
  bankAccountType?: 'CHECKING' | 'SAVINGS' | ''
  bankInfo?: string
  commissionTiers: CommissionTier[]
  notes?: string
}

export async function listPartners(): Promise<PartnerListItem[]> {
  const res = await api.get('/admin/partners')
  return res.data.data
}

export async function getPartner(id: string): Promise<PartnerDetail> {
  const res = await api.get(`/admin/partners/${id}`)
  return res.data.data
}

export async function createPartner(input: CreatePartnerInput): Promise<{ id: string; code: string }> {
  const res = await api.post('/admin/partners', input)
  return res.data.data
}

export async function updatePartner(id: string, input: Partial<CreatePartnerInput & { isActive: boolean }>): Promise<void> {
  await api.patch(`/admin/partners/${id}`, input)
}

export async function deletePartner(id: string): Promise<void> {
  await api.delete(`/admin/partners/${id}`)
}

export async function commissionsReport(params: {
  month: string
  partnerId?: string
  status?: string
}): Promise<CommissionsReportData> {
  const res = await api.get('/admin/partners/commissions-report', { params })
  return res.data.data
}

export async function markCommissionAsPaid(id: string, notes?: string): Promise<void> {
  await api.post(`/admin/partners/commissions/${id}/mark-paid`, { notes })
}

export async function bulkMarkCommissionsAsPaid(ids: string[]): Promise<{ updated: number; requested: number }> {
  const res = await api.post('/admin/partners/commissions/bulk-mark-paid', { ids })
  return res.data.data
}

// ─── Tenant-side (gestor) ──────────────────────────────────────

export interface TenantPartnerCurrent {
  id: string
  name: string
  code: string
  isActive: boolean
  since: string | null
}

export interface TenantPartnerHistoryItem {
  id: string
  oldPartner: { id: string; name: string; code: string } | null
  newPartner: { id: string; name: string; code: string } | null
  changedByUser: { id: string; name: string } | null
  source: string
  createdAt: string
}

export async function getTenantPartner(): Promise<{ current: TenantPartnerCurrent | null; history: TenantPartnerHistoryItem[] }> {
  const res = await api.get('/tenant-partner')
  return res.data.data
}

export async function setTenantPartner(code: string): Promise<{ current: TenantPartnerCurrent }> {
  const res = await api.post('/tenant-partner', { code })
  return res.data.data
}

export async function unsetTenantPartner(): Promise<void> {
  await api.delete('/tenant-partner')
}

export async function validatePartnerCode(code: string): Promise<{ name: string; code: string }> {
  const res = await api.get(`/tenant-partner/validate/${encodeURIComponent(code)}`)
  return res.data.data
}
