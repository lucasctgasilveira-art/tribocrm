import api from './api'

// Service da gestão de API keys do tenant logado. Usa o JWT
// (axios já injeta) — não confundir com a API pública (Bearer
// tcrm_live_...). Endpoints expostos pelo backend em /api-keys.

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  creator: { id: string; name: string } | null
}

export interface CreatedApiKey {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  // A key em texto plano. Aparece UMA ÚNICA VEZ aqui — depois disso
  // só o hash fica no servidor.
  key: string
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await api.get('/api-keys')
  return res.data.data
}

export async function createApiKey(name: string): Promise<CreatedApiKey> {
  const res = await api.post('/api-keys', { name })
  return res.data.data
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/api-keys/${id}`)
}
