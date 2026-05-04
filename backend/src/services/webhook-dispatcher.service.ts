import crypto from 'crypto'
import { prisma } from '../lib/prisma'

/**
 * Dispatcher de webhooks de saída.
 *
 * Fluxo:
 *   1. Algum controller (leads, tasks etc.) chama triggerWebhookEvent.
 *   2. Buscamos endpoints ativos do tenant que escutam aquele evento.
 *   3. Pra cada endpoint, criamos uma WebhookDelivery (PENDING) e
 *      tentamos entregar imediatamente (fire-and-forget — não bloqueia
 *      o request original).
 *   4. Se falhar, marca PENDING com nextRetryAt no futuro. Cron processa.
 *   5. Após 3 tentativas falhas, marca FAILED definitivo.
 *
 * Timeouts e limites:
 *   - 5s de timeout do POST (cliente lento não trava nossa fila).
 *   - Body capturado até 1024 chars pra log (resposta enorme não enche DB).
 *   - Tentativas: imediata, +30s, +5min. Após 3 falhas → FAILED.
 *
 * Segurança:
 *   - HMAC SHA-256 do payload assinado com o secret do endpoint.
 *   - Header X-TriboCRM-Signature: sha256=<hex>
 *   - Header X-TriboCRM-Event: <eventType>
 *   - Cliente valida a assinatura antes de processar.
 */

// Atrasos pra retry (em segundos a partir do attempt anterior).
// Index = attemptCount após a tentativa que falhou.
//   attemptCount=1 → segunda tentativa em +30s
//   attemptCount=2 → terceira em +5min
//   attemptCount>=3 → FAILED definitivo
const RETRY_DELAYS_SECONDS = [30, 5 * 60]

const REQUEST_TIMEOUT_MS = 5000
const MAX_RESPONSE_BODY_CHARS = 1024

export type WebhookEventType =
  | 'lead.created'
  | 'lead.stage_changed'
  | 'lead.won'
  | 'lead.lost'
  | 'task.completed'

export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  'lead.created',
  'lead.stage_changed',
  'lead.won',
  'lead.lost',
  'task.completed',
]

interface DispatchResult {
  ok: boolean
  status?: number
  body?: string
  error?: string
}

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Faz UMA tentativa de POST pro endpoint. Não persiste nada — quem
 * chama é responsável por atualizar a WebhookDelivery.
 */
async function attemptDelivery(
  url: string,
  secret: string,
  eventType: string,
  payload: object,
): Promise<DispatchResult> {
  const body = JSON.stringify(payload)
  const signature = signPayload(secret, body)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TriboCRM-Signature': `sha256=${signature}`,
        'X-TriboCRM-Event': eventType,
        'User-Agent': 'TriboCRM-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    })

    let responseBody = ''
    try {
      const text = await res.text()
      responseBody = text.slice(0, MAX_RESPONSE_BODY_CHARS)
    } catch { /* ignore */ }

    return {
      ok: res.ok,
      status: res.status,
      body: responseBody,
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.name === 'AbortError'
        ? `timeout após ${REQUEST_TIMEOUT_MS}ms`
        : (err?.message ?? 'erro desconhecido'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Processa UMA delivery: tenta entregar e atualiza o status. Usado
 * tanto pelo trigger inicial quanto pelo cron de retry.
 */
export async function processDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  })
  if (!delivery) return
  if (delivery.status !== 'PENDING') return
  if (!delivery.endpoint.isActive) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        lastError: 'Endpoint desativado antes da entrega',
        nextRetryAt: null,
      },
    })
    return
  }

  const result = await attemptDelivery(
    delivery.endpoint.url,
    delivery.endpoint.secret,
    delivery.eventType,
    delivery.payload as object,
  )

  const newAttemptCount = delivery.attemptCount + 1

  if (result.ok) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SUCCESS',
        attemptCount: newAttemptCount,
        lastResponseStatus: result.status ?? null,
        lastResponseBody: result.body ?? null,
        lastError: null,
        nextRetryAt: null,
        deliveredAt: new Date(),
      },
    })
    return
  }

  // 4xx (que não 408/429) NÃO é retryable — cliente respondeu de
  // verdade dizendo "não quero" ou "URL errada". Marca FAILED na hora.
  const isRetryable =
    !result.status ||
    result.status >= 500 ||
    result.status === 408 ||
    result.status === 429

  const stillCanRetry = isRetryable && newAttemptCount < (RETRY_DELAYS_SECONDS.length + 1)

  if (stillCanRetry) {
    const delaySeconds = RETRY_DELAYS_SECONDS[newAttemptCount - 1]!
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000)
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: newAttemptCount,
        lastResponseStatus: result.status ?? null,
        lastResponseBody: result.body ?? null,
        lastError: result.error ?? null,
        nextRetryAt,
        status: 'PENDING',
      },
    })
  } else {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: newAttemptCount,
        lastResponseStatus: result.status ?? null,
        lastResponseBody: result.body ?? null,
        lastError: result.error ?? null,
        nextRetryAt: null,
        status: 'FAILED',
      },
    })
  }
}

/**
 * Envelopa o payload bruto com metadados padrão (event, timestamp).
 * Mantém shape consistente entre todos os tipos de evento — cliente
 * pode parsear genérico.
 */
function buildEnvelope(eventType: WebhookEventType, data: object) {
  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  }
}

/**
 * Disparado pelos controllers (lead, task etc.). Cria UMA delivery
 * pra cada endpoint ativo do tenant que escuta esse evento, e tenta
 * entregar imediatamente em background (fire-and-forget).
 *
 * O parâmetro `data` é envolvido pelo envelope { event, timestamp, data }
 * antes de ser enviado.
 *
 * Nunca lança — falha aqui não pode quebrar o request principal.
 */
export function triggerWebhookEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: object,
): void {
  ;(async () => {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
          tenantId,
          isActive: true,
          events: { has: eventType },
        },
        select: { id: true },
      })

      if (endpoints.length === 0) return

      const envelope = buildEnvelope(eventType, data)

      const deliveries = await Promise.all(
        endpoints.map(ep =>
          prisma.webhookDelivery.create({
            data: {
              tenantId,
              endpointId: ep.id,
              eventType,
              payload: envelope as any,
              status: 'PENDING',
            },
            select: { id: true },
          }),
        ),
      )

      for (const d of deliveries) {
        processDelivery(d.id).catch(err => {
          console.error(`[Webhooks] processDelivery ${d.id} error:`, err?.message ?? err)
        })
      }
    } catch (err: any) {
      console.error('[Webhooks] triggerWebhookEvent error:', err?.message ?? err)
    }
  })()
}

/**
 * Re-dispara uma delivery que tinha falhado (botão "reenviar" da UI).
 * Reseta status pra PENDING e attemptCount pra 0 — vai ter mais 3
 * tentativas. Bloqueia se a delivery atual está PENDING (evita
 * duplicação se cron está prestes a processar).
 */
export async function resendDelivery(deliveryId: string): Promise<void> {
  const existing = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { status: true },
  })
  if (!existing) throw new Error('Delivery não encontrada')
  if (existing.status === 'PENDING') {
    throw new Error('Delivery já está pendente. Aguarde o retry automático.')
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'PENDING',
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
    },
  })

  processDelivery(deliveryId).catch(err => {
    console.error(`[Webhooks] resend processDelivery ${deliveryId} error:`, err?.message ?? err)
  })
}

/**
 * Gera um secret novo pra um endpoint. 32 bytes hex = 64 chars.
 * Cliente vê só na criação (e numa "regenerar" futura, se quisermos
 * adicionar). Nunca aparece em listagens.
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}
