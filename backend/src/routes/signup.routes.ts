import { Router } from 'express'
import cors from 'cors'
import { publicSignup, verifyEmail, resendVerification } from '../controllers/signup.controller'
import { forgotPassword, resetPassword } from '../controllers/password.controller'

// Public signup, email verification and password reset. Mounted under
// /public in app.ts BEFORE any authenticated router so authMiddleware
// never intercepts. CORS is permissive (origin: true) since signup may
// be invoked from the marketing landing, not only app.tribocrm.com.br.
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
router.post('/resend-verification', resendVerification)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

export default router
