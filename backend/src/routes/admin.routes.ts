import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { adminOnly } from '../middleware/admin.middleware'
import {
  getAdminDashboard, getTenants, getTenant, updateTenant, getFinancial,
} from '../controllers/admin.controller'

const router = Router()

router.use(authMiddleware)
router.use(adminOnly)

router.get('/dashboard', getAdminDashboard)
router.get('/tenants', getTenants)
router.get('/tenants/:id', getTenant)
router.patch('/tenants/:id', updateTenant)
router.get('/financial', getFinancial)

export default router
