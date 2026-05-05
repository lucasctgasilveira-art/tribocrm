import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { validateNotSelfReferral } from '../services/commission-engine.service'

/**
 * Endpoints do gestor pra gerenciar o parceiro vinculado ao tenant.
 *
 *   GET    /tenant-partner            Mostra parceiro atual + histórico
 *   POST   /tenant-partner            Vincula código (cliente novo OU troca)
 *   DELETE /tenant-partner            Remove vínculo (raro — só Super Admin via UI seria mais lógico)
 *
 * Apenas OWNER e MANAGER acessam (gate no controller).
 *
 * Regra de auto-indicação: bloqueia se tenant.document ou tenant.email
 * coincide com partner.document/email.
 */

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'MANAGER'
}

// ─── GET /tenant-partner ────────────────────────────────────────
//
// Retorna { current, history }:
//   current: { id, name, code } se vinculado, ou null
//   history: lista de TenantPartnerChange (oldPartner, newPartner, source, createdAt)
export async function getTenantPartner(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId
  if (tenantId === 'platform') {
    res.json({ success: true, data: { current: null, history: [] } })
    return
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        referredAt: true,
        referredBy: {
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    })

    if (!tenant) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' } })
      return
    }

    const history = await prisma.tenantPartnerChange.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        oldPartner: { select: { id: true, name: true, code: true } },
        newPartner: { select: { id: true, name: true, code: true } },
        changedByUser: { select: { id: true, name: true } },
      },
    })

    res.json({
      success: true,
      data: {
        current: tenant.referredBy
          ? { ...tenant.referredBy, since: tenant.referredAt }
          : null,
        history,
      },
    })
  } catch (error: any) {
    console.error('[TenantPartner] get error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar parceiro' } })
  }
}

// ─── POST /tenant-partner ───────────────────────────────────────
//
// Body: { code: string }. Vincula o tenant ao partner que tem esse code.
// Se já tinha parceiro, troca (registra histórico). Lucas confirmou:
// cliente pode trocar a qualquer momento, mudança vale a partir da
// próxima cobrança paga (já é o comportamento por construção: comissão
// é criada no momento que charge vira PAID, lendo o tenant.referredByPartnerId
// daquele instante).
export async function setTenantPartner(req: Request, res: Response): Promise<void> {
  const { tenantId, userId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem vincular parceiro' } })
    return
  }
  if (tenantId === 'platform') {
    res.status(400).json({ success: false, error: { code: 'NO_TENANT_CONTEXT', message: 'Sem contexto de tenant' } })
    return
  }

  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : ''
  if (!code) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code é obrigatório' } })
    return
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { code },
      select: { id: true, name: true, code: true, isActive: true },
    })
    if (!partner) {
      res.status(404).json({ success: false, error: { code: 'PARTNER_NOT_FOUND', message: 'Código de parceiro não encontrado' } })
      return
    }
    if (!partner.isActive) {
      res.status(409).json({ success: false, error: { code: 'PARTNER_INACTIVE', message: 'Esse parceiro está inativo' } })
      return
    }

    // Anti-fraude: parceiro não pode usar próprio código
    const validation = await validateNotSelfReferral(tenantId, partner.id)
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: { code: 'SELF_REFERRAL_BLOCKED', message: validation.reason ?? 'Auto-indicação não permitida' },
      })
      return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { referredByPartnerId: true },
    })
    if (!tenant) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' } })
      return
    }

    if (tenant.referredByPartnerId === partner.id) {
      // Já está vinculado a esse mesmo parceiro — no-op, retorna sucesso.
      res.json({
        success: true,
        data: { current: { id: partner.id, name: partner.name, code: partner.code }, alreadyLinked: true },
      })
      return
    }

    const userIdUuid = userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          referredByPartnerId: partner.id,
          referredAt: tenant.referredByPartnerId ? undefined : new Date(),
          // referredAt mantém a data ORIGINAL do primeiro vínculo. Trocas
          // posteriores não atualizam — pra preservar a noção de "indicado em".
        },
      }),
      prisma.tenantPartnerChange.create({
        data: {
          tenantId,
          oldPartnerId: tenant.referredByPartnerId,
          newPartnerId: partner.id,
          changedBy: userIdUuid,
          source: 'gestor_ui',
        },
      }),
    ])

    res.json({
      success: true,
      data: { current: { id: partner.id, name: partner.name, code: partner.code } },
    })
  } catch (error: any) {
    console.error('[TenantPartner] set error:', { code: error?.code, message: error?.message })
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao vincular parceiro' } })
  }
}

// ─── DELETE /tenant-partner ─────────────────────────────────────
//
// Remove vínculo. Comissões já existentes ficam — só impede novas.
// Histórico registra (oldPartnerId, newPartnerId=NULL).
export async function unsetTenantPartner(req: Request, res: Response): Promise<void> {
  const { tenantId, userId, role } = req.user!
  if (!canManage(role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Apenas gestores e proprietários podem remover vínculo' } })
    return
  }
  if (tenantId === 'platform') {
    res.status(400).json({ success: false, error: { code: 'NO_TENANT_CONTEXT', message: 'Sem contexto de tenant' } })
    return
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { referredByPartnerId: true },
    })
    if (!tenant?.referredByPartnerId) {
      res.status(409).json({ success: false, error: { code: 'NO_PARTNER', message: 'Tenant não tem parceiro vinculado' } })
      return
    }

    const userIdUuid = userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { referredByPartnerId: null },
      }),
      prisma.tenantPartnerChange.create({
        data: {
          tenantId,
          oldPartnerId: tenant.referredByPartnerId,
          newPartnerId: null,
          changedBy: userIdUuid,
          source: 'gestor_ui',
        },
      }),
    ])

    res.json({ success: true })
  } catch (error: any) {
    console.error('[TenantPartner] unset error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao remover vínculo' } })
  }
}

// ─── GET /tenant-partner/validate/:code ─────────────────────────
//
// Valida um código e retorna nome do parceiro pra mostrar na UI antes
// de salvar. Não exige auth de tenant — usado tanto na área do gestor
// quanto pela landing pra mostrar "Você está sendo indicado por..."
// Mas ainda fica em /tenant-partner com auth pra evitar enumeration
// pública. Pra landing usaremos /public/partners/validate.
export async function validatePartnerCode(req: Request, res: Response): Promise<void> {
  const code = typeof req.params.code === 'string' ? req.params.code.trim().toUpperCase() : ''
  if (!code) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code é obrigatório' } })
    return
  }

  try {
    const partner = await prisma.partner.findUnique({
      where: { code },
      select: { id: true, name: true, code: true, isActive: true },
    })
    if (!partner || !partner.isActive) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Código não encontrado ou inativo' } })
      return
    }
    // Não retornamos id aqui — só o que a UI precisa pra confirmar.
    res.json({ success: true, data: { name: partner.name, code: partner.code } })
  } catch (error: any) {
    console.error('[TenantPartner] validate error:', error)
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao validar código' } })
  }
}
