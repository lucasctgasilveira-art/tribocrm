import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getLeads, getLead, createLead, updateLead, deleteLead,
  importLeads, getImportTemplate, exportLeads, bulkUpdateLeads,
  getLossReasons,
} from '../controllers/leads.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

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
    // Mirror `content` → `description` so clients can read either key.
    // The DB column is `content`; `description` is an API-level alias.
    const data = interactions.map(i => ({ ...i, description: i.content }))
    res.json({ success: true, data })
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
    const { type, content, notes, description } = req.body
    // Accept content/description/notes in any combination — single source of
    // truth is the `content` column, but clients that write `description`
    // (or legacy `notes`) keep working.
    const body = content || description || notes || ''
    if (!type) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'type é obrigatório' } }); return }
    const interaction = await prisma.interaction.create({
      data: { tenantId, leadId, userId, type, content: body, isAuto: false },
    })
    // Update lastActivityAt on the lead
    await prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
    res.status(201).json({ success: true, data: { ...interaction, description: interaction.content } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// ── Purchase history ──
//
// Returns every LeadPurchase row for this lead, ordered oldest-first,
// plus two aggregate helpers the drawer renders in its header:
//   total         → sum of all closedValue
//   clienteSince  → wonAt of the earliest purchase (null if none)
// Hidden by the caller when the purchases list is empty.
router.get('/:id/purchases', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const purchases = await prisma.leadPurchase.findMany({
      where: { leadId, tenantId },
      orderBy: { wonAt: 'asc' },
      select: {
        id: true,
        closedValue: true,
        wonAt: true,
        productName: true,
        closedBy: true,
      },
    })

    const total = purchases.reduce((sum, p) => sum + Number(p.closedValue), 0)
    const clienteSince = purchases.length > 0 ? purchases[0]!.wonAt : null

    res.json({
      success: true,
      data: {
        purchases: purchases.map(p => ({
          id: p.id,
          closedValue: Number(p.closedValue),
          wonAt: p.wonAt,
          productName: p.productName,
          closedBy: p.closedBy,
        })),
        total,
        clienteSince,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

export default router
