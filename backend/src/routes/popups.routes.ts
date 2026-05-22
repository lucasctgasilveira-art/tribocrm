import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const router = Router()
router.use(authMiddleware)

// Mapeamentos PT-BR (admin) → códigos ENG esperados pelo PopupManager
const TYPE_MAP: Record<string, string> = {
  'Inadimplência': 'OVERDUE',
  'Manutenção': 'MAINTENANCE',
  'Novidade': 'NEWS',
  'Promoção': 'PROMO',
  'Pesquisa': 'SURVEY',
  'Boas-vindas': 'WELCOME',
}

const FREQ_MAP: Record<string, string> = {
  'A cada login': 'ALWAYS_LOGIN',
  '1x por sessão': 'ONCE_PER_SESSION',
  '1x por dia': 'ONCE_PER_DAY',
  '1x por semana': 'ONCE_PER_WEEK',
  '1x por usuário': 'ONCE_PER_USER',
}

// Fallback de título quando o popup não tem title cadastrado.
// Mantém o sistema usável pra popups antigos (criados antes do campo title).
const TITLE_FALLBACK: Record<string, string> = {
  'Inadimplência': 'Atenção: pagamento em atraso',
  'Manutenção': 'Manutenção programada',
  'Novidade': 'Novidade no TriboCRM',
  'Promoção': 'Promoção especial',
  'Pesquisa': 'Sua opinião conta',
  'Boas-vindas': 'Bem-vindo ao TriboCRM!',
}

// Prioridade derivada do tipo. Inadimplência e Manutenção são urgentes
// (entram na fila imediatamente). Resto entra com delay (priority 2).
const PRIORITY_MAP: Record<string, 1 | 2> = {
  'Inadimplência': 1,
  'Manutenção': 1,
  'Novidade': 2,
  'Promoção': 2,
  'Pesquisa': 2,
  'Boas-vindas': 2,
}

function mapInstance(instances: string[]): 'INSTANCE_2' | 'INSTANCE_3' | 'BOTH' {
  const hasGestor = instances.includes('Gestor')
  const hasVendedor = instances.includes('Vendedor')
  if ((hasGestor && hasVendedor) || instances.length === 0) return 'BOTH'
  if (hasGestor) return 'INSTANCE_2'
  return 'INSTANCE_3'
}

router.get('/active', async (req: Request, res: Response) => {
  try {
    // Super admin não vê pop-ups de cliente. Defesa em camadas (frontend
    // já filtra via !isSuperAdmin no AppLayout).
    if (req.user!.role === 'SUPER_ADMIN' && !req.user!.linkedTenantId) {
      res.json({ success: true, data: [] })
      return
    }

    // Carrega usuário + tenant + plan numa única query
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        role: true,
        tenant: { select: { plan: { select: { name: true } } } },
      },
    })

    if (!user) {
      res.json({ success: true, data: [] })
      return
    }

    // Instance do usuário logado:
    // OWNER, MANAGER, TEAM_LEADER → Gestor
    // SELLER → Vendedor
    const userInstance = user.role === 'SELLER' ? 'Vendedor' : 'Gestor'
    const userPlanName = user.tenant?.plan?.name ?? ''

    const now = new Date()

    // Busca popups ativos no banco
    const popups = await prisma.popup.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filtro de instância e plano feito em memória (são listas pequenas,
    // não vale complicar a query Prisma com array overlaps).
    const filtered = popups.filter((p) => {
      // Filtro instância: lista vazia OU contém a instância do usuário
      const instanceOk =
        p.instances.length === 0 ||
        p.instances.includes(userInstance) ||
        (p.instances.includes('Gestor') && p.instances.includes('Vendedor'))

      // Filtro plano: "Todos" libera tudo, senão precisa do nome do plano
      const planOk =
        p.plans.length === 0 ||
        p.plans.includes('Todos') ||
        (userPlanName && p.plans.includes(userPlanName))

      return instanceOk && planOk
    })

    // Converte para o shape PopupData que o PopupManager espera
    const mapped = filtered.map((p) => ({
      id: p.id,
      type: TYPE_MAP[p.type] ?? 'NEWS',
      title: p.title || TITLE_FALLBACK[p.type] || 'Comunicado',
      message: p.message,
      ctaLabel: p.buttonLabel ?? undefined,
      ctaUrl: p.buttonUrl ?? undefined,
      imageUrl: p.imageUrl ?? undefined,
      targetInstance: mapInstance(p.instances),
      frequency: FREQ_MAP[p.frequency] ?? 'ONCE_PER_SESSION',
      priority: PRIORITY_MAP[p.type] ?? 2,
    }))

    res.json({ success: true, data: mapped })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    })
  }
})

export default router
