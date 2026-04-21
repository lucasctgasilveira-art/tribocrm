import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import { prisma } from '../lib/prisma'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

/**
 * PATCH /tenants/onboarding
 *
 * Updates the first-access wizard state on the authenticated user's
 * tenant. Only MANAGER/OWNER roles can write these fields — sellers
 * and admins must not be able to flip another tenant's flag.
 *
 * Body: { step?: number; completed?: boolean }
 *   - step:        clamped to [0, 3]
 *   - completed:   when true, also sets step=3 for consistency
 *
 * Returns the fresh { onboardingStep, onboardingCompleted } pair so the
 * frontend can update its local copy in one round-trip.
 */
router.patch('/onboarding', async (req: Request, res: Response) => {
  try {
    const role = req.user!.role
    if (role !== 'MANAGER' && role !== 'OWNER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Apenas gestor pode alterar o onboarding do tenant' },
      })
      return
    }

    const tenantId = req.user!.tenantId
    if (tenantId === 'platform') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TENANT', message: 'Super Admin não tem onboarding de tenant' },
      })
      return
    }

    const { step, completed } = req.body as { step?: number; completed?: boolean }

    const data: { onboardingStep?: number; onboardingCompleted?: boolean } = {}
    if (typeof step === 'number') {
      data.onboardingStep = Math.max(0, Math.min(3, Math.trunc(step)))
    }
    if (typeof completed === 'boolean') {
      data.onboardingCompleted = completed
      if (completed) data.onboardingStep = 3
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'step ou completed é obrigatório' },
      })
      return
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { onboardingStep: true, onboardingCompleted: true },
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Tenants] onboarding update error:', error?.message ?? error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    })
  }
})

// ── Tenant self-service (sub-etapa 6M.1.b) ──
//
// PATCH /tenants/me permite que OWNER/MANAGER editem dados básicos
// do próprio tenant (razão social, nome fantasia, contato e endereço
// completo). Campos sensíveis (status, planId, trialEndsAt,
// internalNotes, cnpj, document, billing state e billing Efi)
// continuam restritos ao super admin via PATCH /admin/tenants/:id.
// Sem essa rota, tenants pré-5D ficam presos quando o backend exige
// endereço completo em /subscription-form-data sem oferecer caminho
// de correção.

// Mesma seleção usada pelo PATCH abaixo — extraída pra reuso entre
// GET (hidratação inicial do form) e PATCH (response pós-update).
const myTenantSelect = {
  id: true,
  name: true,
  tradeName: true,
  phone: true,
  email: true,
  cnpj: true,
  document: true,
  addressStreet: true,
  addressNumber: true,
  addressComplement: true,
  addressNeighborhood: true,
  addressCity: true,
  addressState: true,
  addressZip: true,
} as const

router.get('/me', async (req: Request, res: Response) => {
  try {
    const role = req.user!.role
    if (role !== 'OWNER' && role !== 'MANAGER') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Apenas OWNER ou MANAGER podem acessar dados da empresa',
        },
      })
      return
    }

    const tenantId = req.user!.tenantId
    if (tenantId === 'platform') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TENANT', message: 'Super Admin não tem tenant pra consultar' },
      })
      return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: myTenantSelect,
    })

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' },
      })
      return
    }

    res.json({ success: true, data: tenant })
  } catch (err: any) {
    console.error('[GET /tenants/me] erro:', err?.message ?? err)
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Erro ao buscar dados' },
    })
  }
})

const updateMyTenantBodySchema = z.object({
  name: z.string().min(2).max(150).optional(),
  tradeName: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  addressStreet: z.string().max(255).optional(),
  addressNumber: z.string().max(20).optional(),
  addressComplement: z.string().max(150).optional(),
  addressNeighborhood: z.string().max(150).optional(),
  addressCity: z.string().max(150).optional(),
  addressState: z.string().max(30).optional(),
  addressZip: z.string().max(15).optional(),
}).strict()

router.patch('/me', async (req: Request, res: Response) => {
  try {
    const role = req.user!.role
    if (role !== 'OWNER' && role !== 'MANAGER') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Apenas OWNER ou MANAGER podem editar dados da empresa',
        },
      })
      return
    }

    const tenantId = req.user!.tenantId
    if (tenantId === 'platform') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TENANT', message: 'Super Admin não tem tenant pra editar' },
      })
      return
    }

    const parseResult = updateMyTenantBodySchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BODY',
          message: 'Dados inválidos',
          details: parseResult.error.flatten(),
        },
      })
      return
    }

    const data = parseResult.data

    // Sanitização: CEP só dígitos (viacep devolve com hífen) e UF
    // em 2 letras maiúsculas (VARCHAR(2) no banco — frontend pode
    // mandar "SP" ou "sp" ou até "São Paulo" por engano).
    if (data.addressZip !== undefined) {
      data.addressZip = data.addressZip.replace(/\D/g, '')
    }
    if (data.addressState !== undefined) {
      data.addressState = data.addressState.toUpperCase().slice(0, 2)
    }

    const updateData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_CHANGES',
          message: 'Nenhum campo foi enviado pra atualizar',
        },
      })
      return
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: myTenantSelect,
    })

    console.log(
      `[PATCH /tenants/me] tenant ${tenantId} atualizado por user ${req.user!.userId} ` +
      `(role=${role}) — campos: ${Object.keys(updateData).join(', ')}`,
    )

    res.json({ success: true, data: updated })
  } catch (err: any) {
    console.error('[PATCH /tenants/me] erro:', err?.message ?? err)
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: 'Erro ao atualizar dados' },
    })
  }
})

export default router
