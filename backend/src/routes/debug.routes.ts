import { Router } from 'express'

const router = Router()

// Rota DE DEBUG — remove depois de validar Sentry
router.get('/sentry-test', (_req, _res) => {
  throw new Error('Teste L10 Sentry backend - ' + new Date().toISOString())
})

export default router
