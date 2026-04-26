import express from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import * as Sentry from '@sentry/node'
import authRoutes from './routes/auth.routes'
import publicRoutes from './routes/public.routes'
import signupRoutes from './routes/signup.routes'
import pipelineRoutes from './routes/pipeline.routes'
import leadsRoutes from './routes/leads.routes'
import tasksRoutes from './routes/tasks.routes'
import reportsRoutes from './routes/reports.routes'
import usersRoutes from './routes/users.routes'
import productsRoutes from './routes/products.routes'
import notificationsRoutes from './routes/notifications.routes'
import goalsRoutes from './routes/goals.routes'
import templatesRoutes from './routes/templates.routes'
import formsRoutes from './routes/forms.routes'
import automationsRoutes from './routes/automations.routes'
import adminRoutes from './routes/admin.routes'
import oauthRoutes from './routes/oauth.routes'
import paymentsRoutes from './routes/payments.routes'
import webhooksRoutes from './routes/webhooks.routes'
import emailRoutes from './routes/email.routes'
import tenantsRoutes from './routes/tenants.routes'
import debugRoutes from './routes/debug.routes'

const app = express()

// Security
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://tribocrm.vercel.app',
      'https://tribocrm.com.br',
      'https://www.tribocrm.com.br',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'chrome-extension://pgfegmelobfejcgccmdofmpljidffpga',
    ]
    if (!origin || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

// Rate limiting (skip webhooks — Efi sends bursts of notifications)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/webhooks'),
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Muitas requisições. Tente novamente em alguns minutos.' },
  },
})
app.use(limiter)

// Parsing
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } })
})

// Routes
//
// IMPORTANT: public routes (no JWT auth) must be mounted BEFORE usersRoutes.
// usersRoutes is mounted at "/" (no prefix) because its handlers already
// include "/users/..." in their paths. Combined with router.use(authMiddleware)
// inside that router, this means EVERY incoming request hits the auth check
// of usersRoutes first. Authenticated routes work because the token passes
// both middlewares; public routes (like /webhooks/efi, called by Efi to
// validate our endpoint before registering the PIX webhook) get a 401 and
// never reach their actual handler. Order matters here.

// Public embed widget — served as a static JS file from backend/src/public.
// Resolving via __dirname/../src keeps the path stable in both dev
// (__dirname=src → src/public) and prod (__dirname=dist → dist/../src/public),
// assuming the Railway/Nixpacks build keeps src/ alongside dist/.
app.use('/public', express.static(path.join(__dirname, '..', 'src', 'public')))

// Public form endpoints (GET form schema, POST submission). Mounted
// at /public BEFORE usersRoutes so authMiddleware never intercepts.
app.use('/public', publicRoutes)

// Public signup + email verification (POST /public/signup,
// GET /public/verify-email). Same /public prefix, mounted before any
// authenticated router so there's no JWT requirement.
app.use('/public', signupRoutes)

app.use('/webhooks', webhooksRoutes)
app.use('/email', emailRoutes)
app.use('/oauth', oauthRoutes)
app.use('/auth', authRoutes)
app.use('/pipelines', pipelineRoutes)
app.use('/tenants', tenantsRoutes)
app.use('/leads', leadsRoutes)
app.use('/tasks', tasksRoutes)
app.use('/reports', reportsRoutes)
app.use(usersRoutes)
app.use('/products', productsRoutes)
app.use('/notifications', notificationsRoutes)
app.use('/goals', goalsRoutes)
app.use('/templates', templatesRoutes)
app.use('/forms', formsRoutes)
app.use('/automations', automationsRoutes)
app.use('/admin', adminRoutes)
app.use('/payments', paymentsRoutes)
app.use('/debug', debugRoutes)

// Sentry error handler — DEVE vir após todas as routes
// mas ANTES de qualquer outro error handler customizado
Sentry.setupExpressErrorHandler(app)

// Fallback error handler genérico
// (Sentry já capturou o erro antes de chegar aqui)
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Express] Erro não tratado:', err)
  res.status(err.statusCode || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production'
      ? 'Algo deu errado'
      : err.message,
  })
})

export default app
