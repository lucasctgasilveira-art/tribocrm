import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getDashboard,
  getGestaoReports,
  exportGestaoReport,
  exportVendedorReport,
  exportAdminFinanceiro,
  exportAdminDashboard,
} from '../controllers/reports.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

router.get('/dashboard', getDashboard)
router.get('/gestao', getGestaoReports)

// ── Excel exports ─────────────────────────────────────────
// Gestor + vendedor exports are tenant-scoped via req.user.tenantId
// (gestor) or req.user.userId (vendedor). Any authenticated user can
// pull their own role-appropriate report.
router.get('/export/gestor', exportGestaoReport)
router.get('/export/vendedor', exportVendedorReport)
// Admin-only exports. Gated by role here instead of via adminOnly
// middleware so the route can stay under /reports alongside the
// other export endpoints and share authMiddleware + CORS. A
// non-SUPER_ADMIN caller gets a 403.
router.get('/export/admin-financeiro', (req, res, next) => {
  if (req.user?.tenantId !== 'platform') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Acesso restrito a administradores' } })
    return
  }
  exportAdminFinanceiro(req, res).catch(next)
})
router.get('/export/admin-dashboard', (req, res, next) => {
  if (req.user?.tenantId !== 'platform') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Acesso restrito a administradores' } })
    return
  }
  exportAdminDashboard(req, res).catch(next)
})

export default router
