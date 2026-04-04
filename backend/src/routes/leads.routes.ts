import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { getLeads, getLead, createLead, updateLead, deleteLead } from '../controllers/leads.controller'

const router = Router()

router.use(authMiddleware)

router.get('/', getLeads)
router.get('/:id', getLead)
router.post('/', createLead)
router.patch('/:id', updateLead)
router.delete('/:id', deleteLead)

export default router
