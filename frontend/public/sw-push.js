// Service Worker do TriboCRM — exclusivamente pra Web Push notifications.
//
// Não faz cache, não faz offline. Single-purpose: receber push do backend
// e mostrar notificação nativa do SO.
//
// Registrado pelo frontend após o user aceitar o pre-prompt e o navegador
// confirmar permissão. Endpoint da subscription é gerado pelo navegador
// e enviado ao backend via POST /push/subscribe.
//
// Compatibilidade: Chrome, Edge, Firefox, Opera. Safari macOS 13+ também.
// Safari iOS exige PWA instalada como app (limitação Apple).

self.addEventListener('install', (event) => {
  // Ativa imediatamente — não precisa esperar usuário fechar todas as abas
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  // Toma controle das abas já abertas
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'TriboCRM', body: event.data.text() }
  }

  const title = payload.title || 'TriboCRM'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    tag: payload.tag,
    data: { url: payload.url || '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  // Foca aba existente do CRM se já estiver aberta, senão abre nova
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        // Se já tem aba do CRM aberta, navega ela e foca
        if (client.url.includes(self.location.origin)) {
          client.focus()
          return client.navigate(targetUrl).catch(() => client.focus())
        }
      }
      // Senão, abre nova aba na URL alvo
      return self.clients.openWindow(targetUrl)
    })
  )
})
