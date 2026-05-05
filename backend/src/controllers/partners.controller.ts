import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { generatePartnerCode } from '../services/commission-engine.service'

/**
 * Controllers para gestão de parceiros pelo Super Admin.
 * Todas as rotas exigem adminOnly (tenantId === 'platform').
 *
 * Endpoints:
 *   GET    /admin/partners                       Lista parceiros
 *   GET    /admin/partners/:id                   Detalhe + indicações + comissões
 *   POST   /admin/partners                       Cria parceiro (gera código auto)
 *   PATCH  /admin/partners/:id                   Edita
 *   DELETE /admin/partners/:id                   Hard-delete (cascata pra commissions)
 *   GET    /admin/partners/commissions-report    Relatório por mês/competência
 *   POST   /admin/partners/commissions/:id/mark-paid    Marca commission como PAID
 */

// ─── GET /admin/partners ────────────────────────────────────────
export async function listPartners(_req: Request, res: Response): Promise<void> {
  try {
    const partners = await prisma.partner.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        email: true,
        document: true,
        code: true,
        commissionRate: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { referredTenants: true, commissions: true },
        },
      },
    })

    // Soma rápida de comissões disponíveis por parceiro pra mostrar na lista
    const commissionTotals = await prisma.partnerCommission.groupBy({
      by: ['partnerId', 'status'],
      _sum: { commission: true },
    })

    const totalsByPartner = new Map<string, { pending: number; available: number; paid: number }>()
    for (const t of commissionTotals) {
      const cur = totalsByPartner.get(t.partnerId) ?? { pending: 0, available: 0, paid: 0 }
      const v = t._sum.commission ? Number(t._sum.commission) : 0
      if (t.status === 'PENDING') cur.pending = v
      else if (t.status === 'AVAILABLE') cur.available = v
      else if (t.status === 'PAID') cur.paid = v
      totalsByPartner.set(t.partnerId, cur)
    }

    const enriched = partners.map(p => ({
      ...p,
      commissionRate: Number(p.commissionRate),
      totals: totalsByPartner.get(p.id) ?? { pending: 0, available: 0, paid: 0 },
    }))

    res.json({ success: true, data: enriched })
  } catch (error: any) {
    console.error('[Partners] list error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar parceiros' } })
  }
}

// ─── GET /admin/partners/:id ────────────────────────────────────
export async function getPartner(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  try {
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        referredTenants: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            referredAt: true,
            createdAt: true,
          },
          orderBy: { referredAt: 'desc' },
        },
      },
    })

    if (!partner) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Parceiro não encontrado' } })
      return
    }

    const commissions = await prisma.partnerCommission.findMany({
      where: { partnerId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        tenant: { select: { id: true, name: true } },
      },
    })

    res.json({
      success: true,
      data: {
        ...partner,
        commissionRate: Number(partner.commissionRate),
        commissions: commissions.map(c => ({
          ...c,
          amount: Number(c.amount),
          rate: Number(c.rate),
          commission: Number(c.commission),
        })),
      },
    })
  } catch (error: any) {
    console.error('[Partners] get error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar parceiro' } })
  }
}

// ─── POST /admin/partners ───────────────────────────────────────
export async function createPartner(req: Request, res: Response): Promise<void> {
  const { name, email, document, phone, pixKey, bankInfo, commissionRate, notes } = req.body ?? {}

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' } })
    return
  }
  if (typeof email !== 'string' || !email.trim() || !email.includes('@')) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'email inválido' } })
    return
  }
  const rate = Number(commissionRate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'commissionRate deve ser entre 0 e 100' } })
    return
  }

  try {
    const code = await generatePartnerCode()
    const userId = (req as any).user?.userId
    const createdByUuid = userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null

    const partner = await prisma.partner.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        document: typeof document === 'string' && document.trim() ? document.replace(/\D/g, '') : null,
        phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
        pixKey: typeof pixKey === 'string' && pixKey.trim() ? pixKey.trim() : null,
        bankInfo: typeof bankInfo === 'string' && bankInfo.trim() ? bankInfo.trim() : null,
        code,
        commissionRate: new Prisma.Decimal(rate.toString()),
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        createdBy: createdByUuid,
      },
    })

    res.status(201).json({
      success: true,
      data: { ...partner, commissionRate: Number(partner.commissionRate) },
    })
  } catch (error: any) {
    console.error('[Partners] create error:', { code: error?.code, message: error?.message })
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar parceiro' } })
  }
}

// ─── PATCH /admin/partners/:id ──────────────────────────────────
export async function updatePartner(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const { name, email, document, phone, pixKey, bankInfo, commissionRate, isActive, notes } = req.body ?? {}

  const data: Prisma.PartnerUpdateInput = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name inválido' } })
      return
    }
    data.name = name.trim()
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'email inválido' } })
      return
    }
    data.email = email.trim().toLowerCase()
  }
  if (document !== undefined) data.document = typeof document === 'string' && document.trim() ? document.replace(/\D/g, '') : null
  if (phone !== undefined) data.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null
  if (pixKey !== undefined) data.pixKey = typeof pixKey === 'string' && pixKey.trim() ? pixKey.trim() : null
  if (bankInfo !== undefined) data.bankInfo = typeof bankInfo === 'string' && bankInfo.trim() ? bankInfo.trim() : null
  if (notes !== undefined) data.notes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
  if (isActive !== undefined) data.isActive = Boolean(isActive)
  if (commissionRate !== undefined) {
    const rate = Number(commissionRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'commissionRate inválido' } })
      return
    }
    data.commissionRate = new Prisma.Decimal(rate.toString())
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nada pra atualizar' } })
    return
  }

  try {
    const existing = await prisma.partner.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Parceiro não encontrado' } })
      return
    }
    const updated = await prisma.partner.update({ where: { id }, data })
    res.json({
      success: true,
      data: { ...updated, commissionRate: Number(updated.commissionRate) },
    })
  } catch (error: any) {
    console.error('[Partners] update error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao atualizar parceiro' } })
  }
}

// ─── DELETE /admin/partners/:id ─────────────────────────────────
//
// Hard-delete. Cascade apaga commissions e partner_changes; tenants
// indicados ficam com referredByPartnerId=NULL (FK SET NULL).
// Recomendação: prefira "desativar" (isActive=false) — preserva
// histórico. Hard-delete só pra parceiros sem nenhuma comissão
// relevante (ex: cadastro errado).
export async function deletePartner(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  try {
    const existing = await prisma.partner.findUnique({
      where: { id },
      select: { id: true, _count: { select: { commissions: true } } },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Parceiro não encontrado' } })
      return
    }
    if (existing._count.commissions > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'HAS_COMMISSIONS',
          message: 'Parceiro tem comissões registradas. Desative em vez de excluir pra preservar histórico.',
        },
      })
      return
    }
    await prisma.partner.delete({ where: { id } })
    res.json({ success: true })
  } catch (error: any) {
    console.error('[Partners] delete error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao excluir parceiro' } })
  }
}

// ─── GET /admin/partners/commissions-report ─────────────────────
//
// Relatório de comissões por competência (mês). Filtro:
//   month=YYYY-MM      (obrigatório)
//   partnerId          (opcional — filtrar por 1 parceiro)
//   status             (opcional — PENDING/AVAILABLE/PAID/REVERSED)
//
// Por default, retorna comissões cuja availableAt cai no mês solicitado.
// Use status=PAID + paidAt range pra ver pagamentos efetivados.
export async function commissionsReport(req: Request, res: Response): Promise<void> {
  const month = typeof req.query.month === 'string' ? req.query.month : ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'month deve ser YYYY-MM' } })
    return
  }

  const [year, monthIdx] = month.split('-').map(Number) as [number, number]
  const startDate = new Date(Date.UTC(year, monthIdx - 1, 1, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0))

  const where: Prisma.PartnerCommissionWhereInput = {
    availableAt: { gte: startDate, lt: endDate },
  }

  if (typeof req.query.partnerId === 'string' && req.query.partnerId) {
    where.partnerId = req.query.partnerId
  }
  if (typeof req.query.status === 'string' && req.query.status) {
    where.status = req.query.status
  }

  try {
    const commissions = await prisma.partnerCommission.findMany({
      where,
      orderBy: [{ partnerId: 'asc' }, { availableAt: 'asc' }],
      include: {
        partner: { select: { id: true, name: true, code: true, pixKey: true, bankInfo: true, document: true } },
        tenant: { select: { id: true, name: true } },
      },
    })

    // Agrupa por parceiro pra facilitar a UI
    const groupedMap = new Map<string, {
      partner: any
      commissions: any[]
      totalCommission: number
      totalAmount: number
    }>()

    for (const c of commissions) {
      const partnerId = c.partnerId
      const cur = groupedMap.get(partnerId) ?? {
        partner: c.partner,
        commissions: [],
        totalCommission: 0,
        totalAmount: 0,
      }
      cur.commissions.push({
        id: c.id,
        chargeId: c.chargeId,
        tenant: c.tenant,
        amount: Number(c.amount),
        rate: Number(c.rate),
        commission: Number(c.commission),
        status: c.status,
        availableAt: c.availableAt,
        paidAt: c.paidAt,
        notes: c.notes,
        createdAt: c.createdAt,
      })
      cur.totalCommission += Number(c.commission)
      cur.totalAmount += Number(c.amount)
      groupedMap.set(partnerId, cur)
    }

    const groups = Array.from(groupedMap.values())
    const grandTotal = groups.reduce((s, g) => s + g.totalCommission, 0)

    res.json({
      success: true,
      data: {
        month,
        groups,
        totals: {
          totalCommission: grandTotal,
          partnerCount: groups.length,
          commissionCount: commissions.length,
        },
      },
    })
  } catch (error: any) {
    console.error('[Partners] commissionsReport error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar relatório' } })
  }
}

// ─── POST /admin/partners/commissions/:id/mark-paid ─────────────
//
// Super Admin marca commission como PAID após pagar manualmente o parceiro.
// Só permite pra commissions em status AVAILABLE.
export async function markCommissionAsPaid(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const { notes } = req.body ?? {}

  try {
    const existing = await prisma.partnerCommission.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Commission não encontrada' } })
      return
    }
    if (existing.status !== 'AVAILABLE') {
      res.status(409).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Só é possível marcar como PAID commissions em AVAILABLE (atual: ${existing.status})` },
      })
      return
    }

    const updated = await prisma.partnerCommission.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
      },
    })
    res.json({
      success: true,
      data: {
        ...updated,
        amount: Number(updated.amount),
        rate: Number(updated.rate),
        commission: Number(updated.commission),
      },
    })
  } catch (error: any) {
    console.error('[Partners] markPaid error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao marcar como pago' } })
  }
}

// ─── POST /admin/partners/commissions/bulk-mark-paid ────────────
//
// Marca várias commissions como PAID de uma vez. Body: { ids: string[] }.
// Útil quando Super Admin pagou várias do mesmo parceiro de uma vez.
export async function bulkMarkCommissionsAsPaid(req: Request, res: Response): Promise<void> {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  if (ids.length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'ids é obrigatório' } })
    return
  }
  if (ids.length > 200) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Máximo 200 ids por chamada' } })
    return
  }

  try {
    const result = await prisma.partnerCommission.updateMany({
      where: { id: { in: ids }, status: 'AVAILABLE' },
      data: { status: 'PAID', paidAt: new Date() },
    })
    res.json({ success: true, data: { updated: result.count, requested: ids.length } })
  } catch (error: any) {
    console.error('[Partners] bulkMarkPaid error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao processar pagamentos' } })
  }
}
