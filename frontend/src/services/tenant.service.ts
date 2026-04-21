import api from './api'

export interface MyTenant {
  id: string
  name: string
  tradeName: string | null
  phone: string | null
  email: string | null
  cnpj: string | null
  document: string | null
  addressStreet: string | null
  addressNumber: string | null
  addressComplement: string | null
  addressNeighborhood: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
}

export interface UpdateMyTenantPayload {
  name?: string
  tradeName?: string
  phone?: string
  email?: string
  addressStreet?: string
  addressNumber?: string
  addressComplement?: string
  addressNeighborhood?: string
  addressCity?: string
  addressState?: string
  addressZip?: string
}

export async function getMyTenant(): Promise<MyTenant> {
  const response = await api.get('/tenants/me')
  return response.data.data
}

export async function updateMyTenant(payload: UpdateMyTenantPayload): Promise<MyTenant> {
  const response = await api.patch('/tenants/me', payload)
  return response.data.data
}
