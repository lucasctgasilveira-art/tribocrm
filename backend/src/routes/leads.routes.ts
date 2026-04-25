import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getLeads, getLead, createLead, updateLead, deleteLead,
  importLeads, getImportTemplate, exportLeads, bulkUpdateLeads,
  getLossReasons, sellerScope, findLeadByAltPhone,
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

// Lookup reverso por alt-phone — declarado ANTES de /:id pra
// não cair na rota dinâmica. Usado pela extensão Chrome quando
// detecta um telefone no WhatsApp que não bate com o phone
// principal de nenhum lead — verifica se algum lead tem o número
// como alternativo.
router.get('/by-alt-phone/:phone', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const phone = req.params.phone as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const result = await findLeadByAltPhone(prisma, tenantId, phone, role, userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Leads] findLeadByAltPhone error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

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
    const role = req.user!.role
    const userId = req.user!.userId
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }
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
    const role = req.user!.role
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }
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
    const role = req.user!.role
    const userId = req.user!.userId
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }
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

// ── Lead products (itens cotados / carrinho do lead) ──
//
// LeadProduct é o vínculo lead↔product com snapshot de preço (unitPrice
// congela o Product.price no momento do POST) e finalPrice sempre
// calculado server-side: unitPrice × quantity × (1 − discountPercent/100).
// Não confundir com LeadPurchase (histórico de fechamentos).

const round2 = (n: number) => Math.round(n * 100) / 100

const serializeLeadProduct = (i: {
  id: string
  productId: string
  quantity: number
  unitPrice: any
  discountPercent: any
  finalPrice: any
  createdAt: Date
  product: { id: string, name: string, category: string | null }
}) => ({
  id: i.id,
  productId: i.productId,
  quantity: i.quantity,
  unitPrice: Number(i.unitPrice),
  discountPercent: i.discountPercent != null ? Number(i.discountPercent) : null,
  finalPrice: Number(i.finalPrice),
  createdAt: i.createdAt,
  product: i.product,
})

router.get('/:id/products', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }
    const items = await prisma.leadProduct.findMany({
      where: { leadId, tenantId },
      orderBy: { createdAt: 'asc' },
      include: { product: { select: { id: true, name: true, category: true } } },
    })
    const total = round2(items.reduce((sum, i) => sum + Number(i.finalPrice), 0))
    res.json({
      success: true,
      data: { items: items.map(serializeLeadProduct), total },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.post('/:id/products', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId
    const { productId, quantity, discountPercent } = req.body

    if (!productId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'productId é obrigatório' } })
      return
    }
    const qty = quantity !== undefined ? Number(quantity) : 1
    if (!Number.isInteger(qty) || qty < 1) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'quantity deve ser inteiro >= 1' } })
      return
    }
    const discount = discountPercent !== undefined && discountPercent !== null ? Number(discountPercent) : 0
    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'discountPercent deve estar entre 0 e 100' } })
      return
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
    })
    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Produto não encontrado' } })
      return
    }

    if (discount > 0) {
      if (!product.allowsDiscount) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Produto não permite desconto' } })
        return
      }
      const max = product.maxDiscount ? Number(product.maxDiscount) : 0
      if (discount > max) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Desconto excede o máximo permitido (${max}%)` } })
        return
      }
    }

    const duplicate = await prisma.leadProduct.findFirst({
      where: { leadId, productId, tenantId },
      select: { id: true },
    })
    if (duplicate) {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Produto já adicionado a este lead' } })
      return
    }

    const unitPrice = Number(product.price)
    const finalPrice = round2(unitPrice * qty * (1 - discount / 100))
    const created = await prisma.leadProduct.create({
      data: {
        tenantId,
        leadId,
        productId,
        quantity: qty,
        unitPrice,
        discountPercent: discount > 0 ? discount : null,
        finalPrice,
      },
      include: { product: { select: { id: true, name: true, category: true } } },
    })
    res.status(201).json({ success: true, data: serializeLeadProduct(created) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.patch('/:id/products/:itemId', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const itemId = req.params.itemId as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId
    const { quantity, discountPercent } = req.body

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }

    const item = await prisma.leadProduct.findFirst({
      where: { id: itemId, leadId, tenantId },
      include: { product: true },
    })
    if (!item) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item não encontrado' } })
      return
    }

    let newQty = item.quantity
    if (quantity !== undefined) {
      const qty = Number(quantity)
      if (!Number.isInteger(qty) || qty < 1) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'quantity deve ser inteiro >= 1' } })
        return
      }
      newQty = qty
    }

    let newDiscount = item.discountPercent != null ? Number(item.discountPercent) : 0
    if (discountPercent !== undefined) {
      const d = discountPercent === null ? 0 : Number(discountPercent)
      if (Number.isNaN(d) || d < 0 || d > 100) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'discountPercent deve estar entre 0 e 100' } })
        return
      }
      if (d > 0) {
        if (!item.product.allowsDiscount) {
          res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Produto não permite desconto' } })
          return
        }
        const max = item.product.maxDiscount ? Number(item.product.maxDiscount) : 0
        if (d > max) {
          res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Desconto excede o máximo permitido (${max}%)` } })
          return
        }
      }
      newDiscount = d
    }

    const unitPrice = Number(item.unitPrice)
    const finalPrice = round2(unitPrice * newQty * (1 - newDiscount / 100))
    const updated = await prisma.leadProduct.update({
      where: { id: itemId },
      data: {
        quantity: newQty,
        discountPercent: newDiscount > 0 ? newDiscount : null,
        finalPrice,
      },
      include: { product: { select: { id: true, name: true, category: true } } },
    })
    res.json({ success: true, data: serializeLeadProduct(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

router.delete('/:id/products/:itemId', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const itemId = req.params.itemId as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } })
      return
    }

    const item = await prisma.leadProduct.findFirst({
      where: { id: itemId, leadId, tenantId },
      select: { id: true },
    })
    if (!item) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item não encontrado' } })
      return
    }

    await prisma.leadProduct.delete({ where: { id: itemId } })
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } })
  }
})

// ════════════════════════════════════════════════════════════
// PUT /leads/:id/products — replace transactional do array todo
// ════════════════════════════════════════════════════════════

router.put('/:id/products', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId
    const { items } = req.body ?? {}

    // ──────────────────────────────────────────────────────────
    // Validação de payload
    // ──────────────────────────────────────────────────────────
    if (!Array.isArray(items)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'items deve ser array' },
      })
      return
    }

    const MAX_ITEMS = 50
    if (items.length > MAX_ITEMS) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `máximo ${MAX_ITEMS} produtos` },
      })
      return
    }

    for (const item of items) {
      if (!item || typeof item.productId !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'cada item precisa de productId' },
        })
        return
      }
      const qty = Number(item.quantity)
      if (!Number.isInteger(qty) || qty < 1) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'quantity deve ser inteiro >= 1' },
        })
        return
      }
      if (item.discountPercent != null) {
        const dp = Number(item.discountPercent)
        if (Number.isNaN(dp) || dp < 0 || dp > 100) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'discountPercent entre 0-100' },
          })
          return
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // Confirma lead existe + sellerScope
    // ──────────────────────────────────────────────────────────
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    // ──────────────────────────────────────────────────────────
    // Pré-busca catálogo pra validar desconto e calcular preço
    // ──────────────────────────────────────────────────────────
    const productIds = [...new Set(items.map((i: any) => i.productId as string))]
    const catalog = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
      select: {
        id: true, name: true, price: true, allowsDiscount: true,
        maxDiscount: true, category: true,
      },
    })

    const catalogMap = new Map(catalog.map(p => [p.id, p]))

    // Verifica que todos productIds existem no catálogo
    for (const item of items) {
      const product = catalogMap.get(item.productId)
      if (!product) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `produto ${item.productId} não encontrado` },
        })
        return
      }
      if (item.discountPercent != null && item.discountPercent > 0 && !product.allowsDiscount) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `produto "${product.name}" não permite desconto` },
        })
        return
      }
      if (
        item.discountPercent != null &&
        product.maxDiscount != null &&
        Number(item.discountPercent) > Number(product.maxDiscount)
      ) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `desconto excede máximo do produto "${product.name}"` },
        })
        return
      }
    }

    // ──────────────────────────────────────────────────────────
    // Transação: deleta tudo + recria
    // ──────────────────────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      await tx.leadProduct.deleteMany({
        where: { leadId, tenantId },
      })

      const created = []
      for (const item of items) {
        const product = catalogMap.get(item.productId)!
        const unitPrice = Number(product.price)
        const discountPercent = item.discountPercent != null ? Number(item.discountPercent) : 0
        const finalPrice = round2(unitPrice * Number(item.quantity) * (1 - discountPercent / 100))

        const newItem = await tx.leadProduct.create({
          data: {
            tenantId,
            leadId,
            productId: item.productId,
            quantity: Number(item.quantity),
            unitPrice,
            discountPercent: discountPercent > 0 ? discountPercent : null,
            finalPrice,
          },
          select: {
            id: true, productId: true, quantity: true, unitPrice: true,
            discountPercent: true, finalPrice: true, createdAt: true,
            product: { select: { id: true, name: true, category: true } },
          },
        })
        created.push(newItem)
      }

      return created
    })

    // ──────────────────────────────────────────────────────────
    // Serializa resposta com Decimals como number
    // ──────────────────────────────────────────────────────────
    const serialized = result.map(i => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      discountPercent: i.discountPercent != null ? Number(i.discountPercent) : null,
      finalPrice: Number(i.finalPrice),
      createdAt: i.createdAt,
      product: i.product,
    }))

    const total = round2(serialized.reduce((sum, i) => sum + i.finalPrice, 0))

    res.json({
      success: true,
      data: { items: serialized, total },
    })
  } catch (error: any) {
    console.error('[Leads] putLeadProducts (batch) error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

// ════════════════════════════════════════════════════════════
// Note (campo único de anotação livre por lead)
// ════════════════════════════════════════════════════════════

router.get('/:id/note', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true, notes: true },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    res.json({
      success: true,
      data: { content: lead.notes ?? '' },
    })
  } catch (error: any) {
    console.error('[Leads] getNote error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

router.put('/:id/note', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId
    const { content } = req.body ?? {}

    if (typeof content !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'content deve ser string' },
      })
      return
    }

    const MAX_LENGTH = 10000
    if (content.length > MAX_LENGTH) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `content excede ${MAX_LENGTH} caracteres` },
      })
      return
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { notes: content || null },
      select: { id: true, notes: true },
    })

    res.json({
      success: true,
      data: { content: updated.notes ?? '' },
    })
  } catch (error: any) {
    console.error('[Leads] putNote error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

// ════════════════════════════════════════════════════════════
// AltPhones (telefones alternativos do lead)
// ════════════════════════════════════════════════════════════

router.get('/:id/alt-phones', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true, altPhones: true },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    const phones = Array.isArray(lead.altPhones) ? lead.altPhones : []

    res.json({
      success: true,
      data: { phones },
    })
  } catch (error: any) {
    console.error('[Leads] getAltPhones error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

router.put('/:id/alt-phones', async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma')
    const leadId = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId
    const { phones } = req.body ?? {}

    if (!Array.isArray(phones)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'phones deve ser array' },
      })
      return
    }

    const MAX_PHONES = 10
    const MAX_LENGTH = 30

    if (phones.length > MAX_PHONES) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `máximo ${MAX_PHONES} telefones` },
      })
      return
    }

    for (const p of phones) {
      if (typeof p !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'cada phone deve ser string' },
        })
        return
      }
      if (p.length > MAX_LENGTH) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `phone excede ${MAX_LENGTH} caracteres` },
        })
        return
      }
    }

    const seen = new Set<string>()
    const deduped: string[] = []
    for (const p of phones) {
      const key = p.trim()
      if (key && !seen.has(key)) {
        seen.add(key)
        deduped.push(key)
      }
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null, ...sellerScope(role, userId) },
      select: { id: true },
    })

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead não encontrado' },
      })
      return
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { altPhones: deduped },
      select: { id: true, altPhones: true },
    })

    res.json({
      success: true,
      data: { phones: Array.isArray(updated.altPhones) ? updated.altPhones : [] },
    })
  } catch (error: any) {
    console.error('[Leads] putAltPhones error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

export default router
