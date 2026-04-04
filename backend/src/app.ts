import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.routes'
import pipelineRoutes from './routes/pipeline.routes'
import leadsRoutes from './routes/leads.routes'
import tasksRoutes from './routes/tasks.routes'
import reportsRoutes from './routes/reports.routes'
import usersRoutes from './routes/users.routes'
import productsRoutes from './routes/products.routes'
import notificationsRoutes from './routes/notifications.routes'
import goalsRoutes from './routes/goals.routes'

const app = express()

// Security
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
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
app.use('/auth', authRoutes)
app.use('/pipelines', pipelineRoutes)
app.use('/leads', leadsRoutes)
app.use('/tasks', tasksRoutes)
app.use('/reports', reportsRoutes)
app.use(usersRoutes)
app.use('/products', productsRoutes)
app.use('/notifications', notificationsRoutes)
app.use('/goals', goalsRoutes)

export default app
