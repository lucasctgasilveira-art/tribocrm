import api from './api'

// Service de gestão de webhooks de saída do tenant. Usa JWT — não
// confundir com a API pública (Bearer tcrm_live_...). Endpoint backend
// está em /webhook-endpoints (nome separado pra não colidir com
// /webhooks que é receiver de Efi).

export const ALL_EVENT_TYPES = [
  'lead.created',
  'lead.stage_changed',
  'lead.won',
  'lead.lost',
  'task.completed',
] as const

export type WebhookEventType = (typeof ALL_EVENT_TYPES)[number]

export const EVENT_LABELS: Record<WebhookEventType, string> = {
  'lead.created': 'Lead criado',
  'lead.stage_changed': 'Lead mudou de etapa',
  'lead.won': 'Lead virou cliente (venda)',
  'lead.lost': 'Lead perdido',
  'task.completed': 'Tarefa concluída',
}

export interface WebhookEndpoint {
  id: string
  name: string
  url: string
  events: WebhookEventType[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string } | null
  _count?: { deliveries: number }
}

export interface CreatedWebhook {
  id: string
  name: string
  url: string
  events: WebhookEventType[]
  isActive: boolean
  secret: string
  createdAt: string
}

export interface WebhookDelivery {
  id: string
  eventType: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  attemptCount: number
  lastResponseStatus: number | null
  lastResponseBody: string | null
  lastError: string | null
  nextRetryAt: string | null
  deliveredAt: string | null
  createdAt: string
}

export async function listWebhooks(): Promise<WebhookEndpoint[]> {
  const res = await api.get('/webhook-endpoints')
  return res.data.data
}

export async function createWebhook(input: {
  name: string
  url: string
  events: WebhookEventType[]
}): Promise<CreatedWebhook> {
  const res = await api.post('/webhook-endpoints', input)
  return res.data.data
}

export async function updateWebhook(id: string, input: Partial<{
  name: string
  url: string
  events: WebhookEventType[]
  isActive: boolean
}>): Promise<WebhookEndpoint> {
  const res = await api.patch(`/webhook-endpoints/${id}`, input)
  return res.data.data
}

export async function deleteWebhook(id: string): Promise<void> {
  await api.delete(`/webhook-endpoints/${id}`)
}

export async function testWebhook(id: string): Promise<void> {
  await api.post(`/webhook-endpoints/${id}/test`)
}

export async function getWebhookSecret(id: string): Promise<string> {
  const res = await api.get(`/webhook-endpoints/${id}/secret`)
  return res.data.data.secret
}

export async function listDeliveries(id: string, limit = 50): Promise<WebhookDelivery[]> {
  const res = await api.get(`/webhook-endpoints/${id}/deliveries`, { params: { limit } })
  return res.data.data
}

export async function resendDelivery(deliveryId: string): Promise<void> {
  await api.post(`/webhook-endpoints/deliveries/${deliveryId}/resend`)
}
