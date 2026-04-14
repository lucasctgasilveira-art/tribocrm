import { Router } from 'express'
import cors from 'cors'
import { getPublicForm, submitPublicForm } from '../controllers/public.controller'

// Public (no JWT) routes for the embeddable capture form. Mounted
// BEFORE any auth-protected routes in app.ts so requests never hit an
// authMiddleware before reaching these handlers.
//
// CORS is applied per-router to allow tribocrm.com.br (and www) to
// POST from arbitrary landing pages without relaxing the global CORS
// whitelist — the embed.js widget runs on customer sites, so we
// intentionally accept any origin here.
const router = Router()

router.use(
  cors({
    origin: true, // reflect request origin — required for the widget
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
)

router.get('/forms/:embedToken', getPublicForm)
router.post('/forms/:embedToken/submit', submitPublicForm)

export default router
