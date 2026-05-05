import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { adminOnly } from '../middleware/admin.middleware'
import {
  listPartners, getPartner, createPartner, updatePartner, deletePartner,
  commissionsReport, markCommissionAsPaid, bulkMarkCommissionsAsPaid,
} from '../controllers/partners.controller'

// Rotas de gestão de parceiros pelo Super Admin.
// Montadas em /admin/partners no app.ts. authMiddleware + adminOnly
// garantem que só user com tenantId='platform' acessa.
//
// IMPORTANTE: rotas /commissions* declaradas ANTES de /:id pra evitar
// que "commissions" caia na rota dinâmica.

const router = Router()

router.use(authMiddleware)
router.use(adminOnly)

// Relatório de comissões — query params: month, partnerId, status
router.get('/commissions-report', commissionsReport)
// Bulk marcar várias como pagas
router.post('/commissions/bulk-mark-paid', bulkMarkCommissionsAsPaid)
// Marca uma específica como paga
router.post('/commissions/:id/mark-paid', markCommissionAsPaid)

// CRUD parceiros
router.get('/', listPartners)
router.post('/', createPartner)
router.get('/:id', getPartner)
router.patch('/:id', updatePartner)
router.delete('/:id', deletePartner)

export default router
