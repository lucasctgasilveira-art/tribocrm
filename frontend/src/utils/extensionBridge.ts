/**
 * Bridge CRM -> Extensao Chrome.
 *
 * Quando o vendedor clica num botao de WhatsApp dentro do CRM,
 * mandamos { phone, leadId } pra extensao via chrome.runtime.sendMessage
 * ANTES de abrir o wa.me. A extensao guarda em chrome.storage e o
 * content script do WhatsApp Web le no boot pra identificar o lead
 * automaticamente — sem depender de URL/hash que pode ser dropado.
 *
 * Como descobrimos o ID da extensao instalada (que muda entre
 * "carga sem compactacao" e versao da Chrome Web Store):
 *   1. A extensao injeta uma <meta name="tribocrm-extension-id" content="<EXT_ID>">
 *      via content script crm-bridge.ts em document_start.
 *   2. Aqui lemos a meta. Se nao tiver, fallback pro ID conhecido
 *      da Chrome Web Store (publicada).
 *   3. Se a extensao nao estiver instalada, chrome.runtime.sendMessage
 *      retorna erro silenciosamente — caller continua o fluxo
 *      normal (abrir wa.me, vendedor faz busca manual).
 */

const META_NAME = 'tribocrm-extension-id'
const PUBLISHED_EXT_ID = 'pgfegmelobfejcgccmdofmpljidffpga'

interface NotifyPayload {
  phone: string
  leadId?: string | null
}

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (
          extensionId: string,
          message: unknown,
          callback?: (response?: unknown) => void
        ) => void
        lastError?: { message?: string }
      }
    }
  }
}

function getExtensionIds(): string[] {
  const ids: string[] = []
  try {
    const meta = document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`)
    const fromMeta = meta?.content?.trim()
    if (fromMeta) ids.push(fromMeta)
  } catch { /* ignore */ }
  if (!ids.includes(PUBLISHED_EXT_ID)) ids.push(PUBLISHED_EXT_ID)
  return ids
}

/**
 * Manda { phone, leadId } pra extensao se estiver instalada.
 * Nao bloqueia: roda em fire-and-forget. Se a extensao nao
 * estiver instalada (ou erro qualquer), simplesmente nao faz
 * nada e o fluxo do CRM continua normal.
 *
 * @returns Promise que resolve true se o hint foi entregue,
 *          false caso contrario. Geralmente o caller ignora —
 *          util so pra debug/log.
 */
export async function notifyExtensionPhoneHint(payload: NotifyPayload): Promise<boolean> {
  const sendMessage = window.chrome?.runtime?.sendMessage
  if (!sendMessage) return false

  const phone = String(payload.phone ?? '').replace(/\D/g, '')
  if (!phone) return false

  const leadId = payload.leadId ?? null
  const ids = getExtensionIds()

  for (const extId of ids) {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        let resolved = false
        const finish = (v: boolean) => {
          if (!resolved) { resolved = true; resolve(v) }
        }
        // Timeout defensivo — se a extensao nao responder em 500ms,
        // tentamos o proximo ID (ou desistimos)
        const timer = setTimeout(() => finish(false), 500)
        sendMessage(extId, { type: 'CRM_PHONE_HINT', phone, leadId }, (response) => {
          clearTimeout(timer)
          const lastErr = window.chrome?.runtime?.lastError
          if (lastErr) {
            // Extensao com esse ID nao esta instalada — silencioso
            finish(false)
            return
          }
          const r = response as { ok?: boolean } | undefined
          finish(!!r?.ok)
        })
      } catch {
        resolve(false)
      }
    })
    if (ok) return true
  }
  return false
}
