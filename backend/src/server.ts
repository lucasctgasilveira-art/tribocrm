import dotenv from 'dotenv'
dotenv.config()

// Sentry DEVE ser inicializado ANTES de qualquer outro import
// que use Express, conforme documentação oficial @sentry/node v9
import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,  // tracing desabilitado nesta etapa
    sendDefaultPii: false,  // LGPD-friendly: não captura IP/headers automaticamente
  })
  console.log('[Sentry] Inicializado com sucesso')
} else {
  console.log('[Sentry] SENTRY_DSN não configurado, monitoramento desabilitado')
}

import app from './app'
import { initJobs } from './jobs'

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log(`[TriboCRM] Backend rodando na porta ${PORT}`)
  initJobs()
})
