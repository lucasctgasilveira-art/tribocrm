import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import {
  generatePartnerCode, validateCommissionTiers, DEFAULT_COMMISSION_TIERS,
} from '../services/commission-engine.service'
import { validateDocument, stripDocument } from '../utils/validateDocument'

// Telefone brasileiro: 10 ou 11 dígitos só (com ou sem DDD).
// Aceita máscaras pra UX — limpa pra dígitos antes de validar.
function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

// Tipos de conta bancária aceitos.
const ACCOUNT_TYPES = new Set(['CHECKING', 'SAVINGS'])

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
        commissionTiers: true,
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

    // Conta tenants ACTIVE indicados por cada parceiro pra UI mostrar
    // em qual faixa cada um está agora. Single query agrupada — barato.
    const activeCounts = await prisma.tenant.groupBy({
      by: ['referredByPartnerId'],
      where: {
        status: 'ACTIVE',
        referredByPartnerId: { in: partners.map(p => p.id) },
      },
      _count: true,
    })
    const activeByPartner = new Map<string, number>()
    for (const ac of activeCounts) {
      if (ac.referredByPartnerId) activeByPartner.set(ac.referredByPartnerId, ac._count)
    }

    const enriched = partners.map(p => ({
      ...p,
      commissionRate: p.commissionRate ? Number(p.commissionRate) : null,
      activeClientsCount: activeByPartner.get(p.id) ?? 0,
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

    // Quantos clientes ACTIVE o parceiro tem agora — informa qual
    // faixa de comissão está sendo aplicada.
    const activeClientsCount = await prisma.tenant.count({
      where: { referredByPartnerId: id, status: 'ACTIVE' },
    })

    res.json({
      success: true,
      data: {
        ...partner,
        commissionRate: partner.commissionRate ? Number(partner.commissionRate) : null,
        activeClientsCount,
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
  const {
    name, email, document, phone, pixKey, commissionTiers, notes,
    bankName, bankBranch, bankAccount, bankAccountType, bankInfo,
  } = req.body ?? {}

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name é obrigatório' } })
    return
  }
  if (typeof email !== 'string' || !email.trim() || !email.includes('@')) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'email inválido' } })
    return
  }

  // Valida tabela de comissão progressiva. Se vazia ou ausente, usa
  // os defaults (Bronze/Prata/Ouro 15/20/25%).
  const tiersInput = Array.isArray(commissionTiers) && commissionTiers.length > 0
    ? commissionTiers
    : DEFAULT_COMMISSION_TIERS
  const tiersValidation = validateCommissionTiers(tiersInput)
  if (!tiersValidation.valid) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: tiersValidation.reason ?? 'Tabela de comissão inválida' } })
    return
  }

  // CPF/CNPJ: opcional, mas se vier, valida dígitos verificadores.
  // Reusamos a função do signup (mesmo padrão usado em validações de tenant).
  let documentDigits: string | null = null
  if (typeof document === 'string' && document.trim()) {
    documentDigits = stripDocument(document)
    if (documentDigits.length !== 11 && documentDigits.length !== 14) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'CPF/CNPJ deve ter 11 ou 14 dígitos' } })
      return
    }
    if (!validateDocument(documentDigits).valid) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'CPF/CNPJ com dígitos verificadores inválidos' } })
      return
    }
  }

  // Telefone: opcional, mas se vier, valida 10 ou 11 dígitos.
  let phoneClean: string | null = null
  if (typeof phone === 'string' && phone.trim()) {
    if (!isValidPhone(phone)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Telefone deve ter 10 ou 11 dígitos (com DDD)' } })
      return
    }
    phoneClean = phone.trim()
  }

  // Tipo de conta: opcional, mas se vier, valida enum.
  let accountTypeClean: string | null = null
  if (typeof bankAccountType === 'string' && bankAccountType.trim()) {
    const upper = bankAccountType.trim().toUpperCase()
    if (!ACCOUNT_TYPES.has(upper)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tipo de conta deve ser CHECKING ou SAVINGS' } })
      return
    }
    accountTypeClean = upper
  }

  try {
    const code = await generatePartnerCode()
    const userId = (req as any).user?.userId
    const createdByUuid = userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null

    const partner = await prisma.partner.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        document: documentDigits,
        phone: phoneClean,
        pixKey: typeof pixKey === 'string' && pixKey.trim() ? pixKey.trim() : null,
        bankName: typeof bankName === 'string' && bankName.trim() ? bankName.trim() : null,
        bankBranch: typeof bankBranch === 'string' && bankBranch.trim() ? bankBranch.trim() : null,
        bankAccount: typeof bankAccount === 'string' && bankAccount.trim() ? bankAccount.trim() : null,
        bankAccountType: accountTypeClean,
        bankInfo: typeof bankInfo === 'string' && bankInfo.trim() ? bankInfo.trim() : null,
        code,
        // commissionRate (legado) fica null. commissionTiers é o novo source of truth.
        commissionTiers: tiersInput as any,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        createdBy: createdByUuid,
      },
    })

    res.status(201).json({
      success: true,
      data: {
        ...partner,
        commissionRate: partner.commissionRate ? Number(partner.commissionRate) : null,
      },
    })
  } catch (error: any) {
    console.error('[Partners] create error:', { code: error?.code, message: error?.message })
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar parceiro' } })
  }
}

// ─── PATCH /admin/partners/:id ──────────────────────────────────
export async function updatePartner(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const {
    name, email, document, phone, pixKey, commissionTiers, isActive, notes,
    bankName, bankBranch, bankAccount, bankAccountType, bankInfo,
  } = req.body ?? {}

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
  if (document !== undefined) {
    if (typeof document === 'string' && document.trim()) {
      const digits = stripDocument(document)
      if (digits.length !== 11 && digits.length !== 14) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'CPF/CNPJ deve ter 11 ou 14 dígitos' } })
        return
      }
      if (!validateDocument(digits).valid) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'CPF/CNPJ com dígitos verificadores inválidos' } })
        return
      }
      data.document = digits
    } else {
      data.document = null
    }
  }
  if (phone !== undefined) {
    if (typeof phone === 'string' && phone.trim()) {
      if (!isValidPhone(phone)) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Telefone deve ter 10 ou 11 dígitos (com DDD)' } })
        return
      }
      data.phone = phone.trim()
    } else {
      data.phone = null
    }
  }
  if (pixKey !== undefined) data.pixKey = typeof pixKey === 'string' && pixKey.trim() ? pixKey.trim() : null
  if (bankName !== undefined) data.bankName = typeof bankName === 'string' && bankName.trim() ? bankName.trim() : null
  if (bankBranch !== undefined) data.bankBranch = typeof bankBranch === 'string' && bankBranch.trim() ? bankBranch.trim() : null
  if (bankAccount !== undefined) data.bankAccount = typeof bankAccount === 'string' && bankAccount.trim() ? bankAccount.trim() : null
  if (bankAccountType !== undefined) {
    if (typeof bankAccountType === 'string' && bankAccountType.trim()) {
      const upper = bankAccountType.trim().toUpperCase()
      if (!ACCOUNT_TYPES.has(upper)) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tipo de conta deve ser CHECKING ou SAVINGS' } })
        return
      }
      data.bankAccountType = upper
    } else {
      data.bankAccountType = null
    }
  }
  if (bankInfo !== undefined) data.bankInfo = typeof bankInfo === 'string' && bankInfo.trim() ? bankInfo.trim() : null
  if (notes !== undefined) data.notes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
  if (isActive !== undefined) data.isActive = Boolean(isActive)
  if (commissionTiers !== undefined) {
    const validation = validateCommissionTiers(commissionTiers)
    if (!validation.valid) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: validation.reason ?? 'Tabela de comissão inválida' } })
      return
    }
    data.commissionTiers = commissionTiers as any
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
      data: {
        ...updated,
        commissionRate: updated.commissionRate ? Number(updated.commissionRate) : null,
      },
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
        partner: {
          select: {
            id: true, name: true, code: true, document: true,
            pixKey: true, bankName: true, bankBranch: true, bankAccount: true,
            bankAccountType: true, bankInfo: true,
          },
        },
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
