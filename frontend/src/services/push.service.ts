/**
 * Service de Web Push subscriptions no client.
 *
 * Encapsula:
 *   - Registro do Service Worker (/sw-push.js)
 *   - Pedido de permissão nativa
 *   - Subscribe via PushManager (gera endpoint único do device)
 *   - POST /push/subscribe (manda o endpoint pro backend)
 *   - DELETE /push/unsubscribe quando user revoga
 *
 * O fluxo de PRE-PROMPT (modal próprio) fica no componente
 * PushPermissionPrompt — esse service só executa quando o user já
 * aceitou pelo pre-prompt e queremos chamar a API nativa.
 */

import api from './api'

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

const STORAGE_KEY_LAST_ASKED = 'push-prompt-last-asked-at'
const SW_PATH = '/sw-push.js'

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function currentPermission(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as PushPermissionState
}

/**
 * Marca timestamp de quando o pre-prompt foi mostrado e dispensado.
 * Usado pra reperguntar a cada 7 dias se o user clicou "Mais tarde".
 */
export function markPromptDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_ASKED, String(Date.now()))
  } catch { /* ignore */ }
}

/**
 * Decide se devemos mostrar o pre-prompt agora.
 * - Não mostra se navegador não suporta
 * - Não mostra se já tem permissão (granted) — já tá ativo
 * - Não mostra se foi negado (denied) — só recupera via configurações do site
 * - Mostra se nunca foi perguntado OU se passaram >= 7 dias da última vez
 */
export function shouldShowPrompt(reaskAfterDays = 7): boolean {
  if (!isPushSupported()) return false
  const perm = currentPermission()
  if (perm !== 'default') return false

  try {
    const last = localStorage.getItem(STORAGE_KEY_LAST_ASKED)
    if (!last) return true
    const lastMs = parseInt(last, 10)
    if (isNaN(lastMs)) return true
    const daysSince = (Date.now() - lastMs) / (1000 * 60 * 60 * 24)
    return daysSince >= reaskAfterDays
  } catch {
    return true
  }
}

/**
 * Converte VAPID public key (base64url string) pro Uint8Array que o
 * PushManager.subscribe() espera.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Fluxo completo de ativação. Chamado quando user clica "Ativar agora"
 * no pre-prompt.
 *
 * Etapas:
 *   1. Busca VAPID public key do backend
 *   2. Registra Service Worker
 *   3. Pede permissão nativa (se ainda 'default')
 *   4. Se concedida, faz subscribe via PushManager
 *   5. Manda subscription pro backend
 *
 * Retorna o estado final ('granted' / 'denied' / 'unsupported').
 */
export async function enablePushNotifications(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported'

  // 1. Pega VAPID public key
  const keyResp = await api.get('/push/vapid-public-key')
  const publicKey: string = keyResp.data?.data?.publicKey
  if (!publicKey) {
    throw new Error('VAPID public key não disponível')
  }

  // 2. Registra SW (idempotente — se já registrado, retorna o existente)
  const registration = await navigator.serviceWorker.register(SW_PATH)
  await navigator.serviceWorker.ready

  // 3. Permissão nativa
  let permission = currentPermission()
  if (permission === 'default') {
    permission = (await Notification.requestPermission()) as PushPermissionState
  }
  if (permission !== 'granted') {
    markPromptDismissed()
    return permission
  }

  // 4. Subscribe (idempotente — se já tem subscription, devolve a mesma)
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  // 5. POST pro backend
  const json = subscription.toJSON()
  await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  })

  return 'granted'
}

/**
 * Revoga subscription do device atual. Não revoga permissão do navegador
 * (pra isso o user precisa ir nas configurações). Apenas remove o
 * endpoint do banco — para de enviar push pra esse device.
 */
export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await api.delete('/push/unsubscribe', { data: { endpoint } }).catch(() => {})
    }
  } catch (err) {
    console.warn('[push] Erro ao desativar notificações:', err)
  }
}
