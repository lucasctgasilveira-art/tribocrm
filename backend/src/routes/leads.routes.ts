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

export default router
