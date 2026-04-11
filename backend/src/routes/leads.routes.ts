import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  getLeads, getLead, createLead, updateLead, deleteLead,
  importLeads, getImportTemplate, exportLeads, bulkUpdateLeads,
  getLossReasons,
} from '../controllers/leads.controller'

const router = Router()

router.use(authMiddleware)

// Multer config for XLSX upload — in-memory, 5MB cap, only spreadsheet mimetypes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.originalname.toLowerCase().endsWith('.xlsx')
      || file.originalname.toLowerCase().endsWith('.xls')
    if (ok) cb(null, true)
    else cb(new Error('Apenas arquivos .xlsx/.xls são permitidos'))
  },
})

// Import/Export endpoints — must be declared BEFORE /:id so the literal
// path segments are not parsed as a lead id.
router.get('/import/template', getImportTemplate)
router.post('/import', upload.single('file'), importLeads)
router.get('/export', exportLeads)
router.get('/loss-reasons', getLossReasons)
router.patch('/bulk', bulkUpdateLeads)

router.get('/', getLeads)
router.get('/:id', getLead)
router.post('/', createLead)
router.patch('/:id', updateLead)
router.delete('/:id', deleteLead)

// ── Interactions ──

router.get('/:id/interactions', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const interactions = await prisma.interaction.findMany({
      where: { leadId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { id: true, name: true } } },
    })
    res.json({ success: true, data: interactions })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.post('/:id/interactions', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const { type, content, notes } = req.body
    const body = content || notes || ''
    if (!type) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'type é obrigatório' } }); return }
    const interaction = await prisma.interaction.create({
      data: { tenantId, leadId, userId, type, content: body, isAuto: false },
    })
    // Update lastActivityAt on the lead
    await prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
    res.status(201).json({ success: true, data: interaction })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

export default router
