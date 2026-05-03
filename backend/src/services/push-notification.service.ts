/**
 * Service de Web Push Notifications.
 *
 * Encapsula a lib `web-push` (VAPID + envio HTTP). Responsável por:
 *   - Configurar VAPID keys (uma vez no boot)
 *   - Enviar notificação pra todas as subscriptions de um user
 *   - Auto-remover subscriptions expiradas (HTTP 410 Gone)
 *
 * Uso:
 *   import { sendPushToUser } from './push-notification.service'
 *   await sendPushToUser(userId, {
 *     title: 'Lead novo',
 *     body: 'João Silva foi atribuído a você',
 *     url: '/vendas/leads/123',
 *   })
 *
 * Variáveis de ambiente necessárias:
 *   VAPID_PUBLIC_KEY    — pública (também vai pro frontend como VITE_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY   — privada (NUNCA vai pro frontend ou git)
 *   VAPID_SUBJECT       — mailto:email@dominio (RFC8292)
 *
 * Sem VAPID configurado: sendPushToUser vira no-op (log warn) — não
 * quebra o fluxo principal. Útil em dev local sem chaves setadas.
 */

import webpush from 'web-push'
import { prisma } from '../lib/prisma'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:contato@tribocrm.com.br'

let configured = false

function configure(): boolean {
  if (configured) return true
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys ausentes — push notifications desabilitadas')
    return false
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    configured = true
    return true
  } catch (err) {
    console.error('[push] Falha ao configurar VAPID:', err)
    return false
  }
}

export interface PushPayload {
  title: string
  body: string
  url?: string  // pra onde direcionar quando o user clicar na notificação
  icon?: string
  tag?: string  // identificador pra dedupe nativo do browser
}

/**
 * Envia push pra TODAS as subscriptions ativas do user (1 user pode
 * ter N devices). Subscriptions com erro 410 (Gone) são removidas
 * automaticamente — significa que o navegador desinscreveu (user
 * desinstalou app, limpou cookies, etc).
 *
 * Best-effort: nunca lança. Falhas são logadas e ignoradas pra não
 * bloquear o fluxo principal (criar lead, criar tarefa, etc).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configure()) return

  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } })
    if (subs.length === 0) return

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      icon: payload.icon ?? '/icon-192.png',
      tag: payload.tag,
    })

    const results = await Promise.allSettled(
      subs.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        ).catch(async (err: { statusCode?: number }) => {
          // 410 Gone ou 404 Not Found: subscription morreu. Limpa do banco
          // pra não tentar de novo. Outros erros (rede, 5xx no provedor)
          // a gente apenas loga e tenta de novo na próxima.
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
          }
          throw err
        }),
      ),
    )

    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) {
      console.warn(`[push] ${failed}/${subs.length} envios falharam pra user ${userId}`)
    }
  } catch (err) {
    console.error('[push] Erro inesperado em sendPushToUser:', err)
  }
}

/**
 * Mesma coisa pra múltiplos users em batch — útil pra notificar
 * todos OWNER/MANAGER de um tenant (ex: desconto pra aprovar).
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map(uid => sendPushToUser(uid, payload)))
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC
}

export function isPushConfigured(): boolean {
  return configure()
}
