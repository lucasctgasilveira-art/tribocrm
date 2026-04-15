import { Router } from 'express'
import cors from 'cors'
import { publicSignup, verifyEmail } from '../controllers/signup.controller'

// Public signup + email verification. Mounted under /public in app.ts
// BEFORE any authenticated router so authMiddleware never intercepts.
// CORS is permissive (origin: true) since signup may be invoked from
// the marketing landing, not only app.tribocrm.com.br.
const router = Router()

router.use(
  cors({
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
)

router.post('/signup', publicSignup)
router.get('/verify-email', verifyEmail)

export default router
