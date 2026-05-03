import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { sendPushToUsers } from '../services/push-notification.service'

// ── Products ──

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { search, isActive } = req.query as Record<string, string | undefined>

    const where: Prisma.ProductWhereInput = { tenantId }

    if (isActive !== undefined) where.isActive = isActive === 'true'

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    res.json({ success: true, data: products })
  } catch (error) {
    console.error('[Products] getProducts error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { name, description, price, category, maxDiscount = 0, approvalType } = req.body

    if (!name || price === undefined) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name e price são obrigatórios' },
      })
      return
    }

    const allowsDiscount = Number(maxDiscount) > 0

    const product = await prisma.product.create({
      data: {
        tenantId,
        name,
        description: description || null,
        price: new Prisma.Decimal(price),
        category: category || null,
        allowsDiscount,
        discountType: allowsDiscount ? 'PERCENTAGE' : null,
        maxDiscount: allowsDiscount ? new Prisma.Decimal(maxDiscount) : null,
        approvalType: approvalType || (allowsDiscount ? 'PASSWORD' : null),
      },
    })

    res.status(201).json({ success: true, data: product })
  } catch (error) {
    console.error('[Products] createProduct error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.product.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Produto não encontrado' },
      })
      return
    }

    const { name, description, price, category, maxDiscount, approvalType, isActive } = req.body

    const data: Prisma.ProductUpdateInput = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (price !== undefined) data.price = new Prisma.Decimal(price)
    if (category !== undefined) data.category = category
    if (isActive !== undefined) data.isActive = isActive
    if (approvalType !== undefined) data.approvalType = approvalType

    if (maxDiscount !== undefined) {
      const discount = Number(maxDiscount)
      data.allowsDiscount = discount > 0
      data.maxDiscount = discount > 0 ? new Prisma.Decimal(discount) : null
      data.discountType = discount > 0 ? 'PERCENTAGE' : null
    }

    const product = await prisma.product.update({ where: { id }, data })

    res.json({ success: true, data: product })
  } catch (error) {
    console.error('[Products] updateProduct error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId

    const existing = await prisma.product.findFirst({ where: { id, tenantId } })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Produto não encontrado' },
      })
      return
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('[Products] deleteProduct error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

// ── Discount Requests ──

export async function getDiscountRequests(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const { status } = req.query as Record<string, string | undefined>

    const where: Prisma.DiscountRequestWhereInput = { tenantId }
    if (status) where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED'

    const requests = await prisma.discountRequest.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with lead and requestedBy user data
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const lead = await prisma.lead.findUnique({
          where: { id: r.leadId },
          select: { id: true, name: true },
        })
        const requestedByUser = await prisma.user.findUnique({
          where: { id: r.requestedBy },
          select: { id: true, name: true },
        })
        return {
          ...r,
          lead: lead ?? { id: r.leadId, name: 'Desconhecido' },
          requestedByUser: requestedByUser ?? { id: r.requestedBy, name: 'Desconhecido' },
        }
      })
    )

    res.json({ success: true, data: enriched })
  } catch (error) {
    console.error('[Products] getDiscountRequests error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function createDiscountRequest(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId
    const userId = req.user!.userId
    const { productId, leadId, requestedDiscount } = req.body

    if (!productId || !leadId || requestedDiscount === undefined) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'productId, leadId e requestedDiscount são obrigatórios' },
      })
      return
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    })

    if (!product) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Produto não encontrado' },
      })
      return
    }

    const discountPercent = Number(requestedDiscount)
    const maxDiscount = product.maxDiscount ? Number(product.maxDiscount) : 0

    // Auto-approve if discount is within limit and no approval required
    const autoApprove = !product.approvalType || (discountPercent <= maxDiscount && product.approvalType === 'PASSWORD')

    const request = await prisma.discountRequest.create({
      data: {
        tenantId,
        leadId,
        productId,
        requestedBy: userId,
        requestedDiscount: new Prisma.Decimal(discountPercent),
        discountType: 'PERCENTAGE',
        status: autoApprove ? 'APPROVED' : 'PENDING',
        resolvedAt: autoApprove ? new Date() : null,
        approvedBy: autoApprove ? userId : null,
      },
      include: {
        product: { select: { id: true, name: true, price: true } },
      },
    })

    // Notify OWNER/MANAGER users when a discount is pending approval
    if (!autoApprove) {
      try {
        const [lead, seller, managers] = await Promise.all([
          prisma.lead.findUnique({ where: { id: leadId }, select: { name: true } }),
          prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
          prisma.user.findMany({
            where: { tenantId, deletedAt: null, isActive: true, role: { in: ['OWNER', 'MANAGER'] } },
            select: { id: true },
          }),
        ])
        const body = `${seller?.name ?? 'Vendedor'} solicitou desconto de ${discountPercent}% em ${lead?.name ?? 'lead'}`
        await prisma.notification.createMany({
          data: managers.map(m => ({
            tenantId,
            userId: m.id,
            type: 'DISCOUNT_PENDING' as const,
            title: 'Solicitação de desconto',
            body,
            link: `/gestao/leads/${leadId}`,
          })),
        })

        // Push pros gestores (best-effort, fire-and-forget)
        sendPushToUsers(managers.map(m => m.id), {
          title: '✅ Desconto aguardando aprovação',
          body,
          url: `/gestao/leads/${leadId}`,
          tag: `discount-${request.id}`,
        }).catch(() => {})
      } catch (notifErr) {
        console.error('[Products] discount notification failed:', notifErr)
      }
    }

    res.status(201).json({ success: true, data: request })
  } catch (error) {
    console.error('[Products] createDiscountRequest error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}

export async function reviewDiscountRequest(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const tenantId = req.user!.tenantId
    const role = req.user!.role
    const userId = req.user!.userId

    if (role !== 'MANAGER' && role !== 'OWNER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Apenas gestores podem revisar descontos' },
      })
      return
    }

    const existing = await prisma.discountRequest.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    })

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Solicitação não encontrada ou já revisada' },
      })
      return
    }

    const { status, rejectionReason } = req.body

    if (status !== 'APPROVED' && status !== 'REJECTED') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status deve ser APPROVED ou REJECTED' },
      })
      return
    }

    const request = await prisma.discountRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: userId,
        rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
        resolvedAt: new Date(),
      },
      include: {
        product: { select: { id: true, name: true, price: true } },
      },
    })

    // Notify the requesting seller about the decision
    try {
      const lead = await prisma.lead.findUnique({ where: { id: existing.leadId }, select: { name: true } })
      const pct = Number(existing.requestedDiscount)
      const leadName = lead?.name ?? 'lead'
      const body = status === 'APPROVED'
        ? `Seu desconto de ${pct}% para ${leadName} foi aprovado!`
        : `Seu desconto de ${pct}% para ${leadName} foi recusado.`
      await prisma.notification.create({
        data: {
          tenantId,
          userId: existing.requestedBy,
          type: 'DISCOUNT_PENDING' as const,
          title: status === 'APPROVED' ? 'Desconto aprovado' : 'Desconto recusado',
          body,
          link: `/vendas/leads/${existing.leadId}`,
        },
      })
    } catch (notifErr) {
      console.error('[Products] review notification failed:', notifErr)
    }

    res.json({ success: true, data: request })
  } catch (error) {
    console.error('[Products] reviewDiscountRequest error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
}
