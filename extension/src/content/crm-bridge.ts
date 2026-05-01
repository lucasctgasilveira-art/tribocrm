/**
 * Ponte CRM <-> Extensao.
 *
 * Injeta uma <meta name="tribocrm-extension-id" content="<EXT_ID>">
 * no <head> de https://app.tribocrm.com.br/* — assim o frontend do
 * CRM consegue descobrir o ID da extensao instalada (que muda entre
 * carga "sem compactacao" e versao da Chrome Web Store) e enviar
 * mensagens via chrome.runtime.sendMessage(extId, ...).
 *
 * Este content script roda em document_start (manifest) pra que a
 * meta esteja disponivel ANTES de o app React montar e o vendedor
 * tentar clicar em algum botao de WhatsApp.
 *
 * Sem dependencia de imports — IIFE puro pra evitar problemas com
 * CSP e bundling de modulos em content_scripts.
 */

const META_NAME = 'tribocrm-extension-id'

function setMeta(extensionId: string): void {
  // Se ja existe (recarregado), so atualiza o content
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`)
  if (meta) {
    meta.content = extensionId
    return
  }

  meta = document.createElement('meta')
  meta.name = META_NAME
  meta.content = extensionId

  // Em document_start o <head> ainda nao existe — esperamos via
  // observador. Isso cobre tanto o caso de head pronto (insert
  // imediato) quanto pagina sem head ainda (insert no primeiro
  // momento que aparecer).
  if (document.head) {
    document.head.appendChild(meta)
    return
  }

  const observer = new MutationObserver(() => {
    if (document.head) {
      observer.disconnect()
      document.head.appendChild(meta!)
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

try {
  setMeta(chrome.runtime.id)
} catch (err) {
  // Sem chrome.runtime (improvavel — content_script sempre tem)
  console.warn('[TriboCRM:crm-bridge] chrome.runtime indisponivel:', err)
}
