import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// GET /admin/system-logs (Onda 1)
//
// Agrega falhas reais das tabelas EmailLog e WebhookDelivery em um
// formato unificado pra UI de "Logs do Sistema". É read-only —
// não escreve em nenhuma tabela. Tipos futuros (Login, Rate Limit,
// Exportação, Permissão) serão adicionados nas ondas seguintes.

type Period = 'today' | '24h' | '7d' | '30d' | 'all'

interface UnifiedLogItem {
  id: string
  type: 'Erro'
  source: 'email' | 'webhook'
  description: string
  user: string
  ip: string
  date: string
  createdAt: string
}

function resolvePeriodStart(period: Period): Date | null {
  const now = new Date()
  switch (period) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return start
    }
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'all':
    default:
      return null
  }
}

const PER_SOURCE_LIMIT = 200
const TOTAL_LIMIT = 200

export async function getSystemLogs(req: Request, res: Response): Promise<void> {
  try {
    const periodParam = (req.query.period as string | undefined) ?? '7d'
    const validPeriods: Period[] = ['today', '24h', '7d', '30d', 'all']
    const period: Period = (validPeriods as string[]).includes(periodParam)
      ? (periodParam as Period)
      : '7d'

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''

    const periodStart = resolvePeriodStart(period)

    const emailWhere: any = { status: 'FAILED' }
    if (periodStart) emailWhere.sentAt = { gte: periodStart }

    const webhookWhere: any = { status: 'FAILED' }
    if (periodStart) webhookWhere.createdAt = { gte: periodStart }

    const [emailLogs, webhookDeliveries] = await Promise.all([
      prisma.emailLog.findMany({
        where: emailWhere,
        orderBy: { sentAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          tenantId: true,
          toEmail: true,
          subject: true,
          errorReason: true,
          errorDetails: true,
          sentAt: true,
        },
      }),
      prisma.webhookDelivery.findMany({
        where: webhookWhere,
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          tenantId: true,
          eventType: true,
          lastError: true,
          lastResponseStatus: true,
          attemptCount: true,
          createdAt: true,
          endpoint: { select: { name: true, url: true } },
        },
      }),
    ])

    const tenantIds = new Set<string>()
    for (const e of emailLogs) if (e.tenantId) tenantIds.add(e.tenantId)
    for (const w of webhookDeliveries) if (w.tenantId) tenantIds.add(w.tenantId)

    const tenants = tenantIds.size
      ? await prisma.tenant.findMany({
          where: { id: { in: Array.from(tenantIds) } },
          select: { id: true, name: true, tradeName: true },
        })
      : []
    const tenantById = new Map(tenants.map(t => [t.id, t]))

    const items: UnifiedLogItem[] = []

    for (const e of emailLogs) {
      const tenant = e.tenantId ? tenantById.get(e.tenantId) : null
      const tenantLabel = tenant ? (tenant.tradeName || tenant.name) : 'Sistema'
      const reason = e.errorReason ? ` (${e.errorReason})` : ''
      const subjectFragment = e.subject ? ` — "${e.subject}"` : ''
      items.push({
        id: `email-${e.id}`,
        type: 'Erro',
        source: 'email',
        description: `Falha ao enviar e-mail${subjectFragment}${reason}`,
        user: `${tenantLabel} → ${e.toEmail}`,
        ip: '—',
        date: e.sentAt.toISOString(),
        createdAt: e.sentAt.toISOString(),
      })
    }

    for (const w of webhookDeliveries) {
      const tenant = w.tenantId ? tenantById.get(w.tenantId) : null
      const tenantLabel = tenant ? (tenant.tradeName || tenant.name) : 'Sistema'
      const httpFragment = w.lastResponseStatus ? ` HTTP ${w.lastResponseStatus}` : ''
      const endpointName = w.endpoint?.name ? ` → ${w.endpoint.name}` : ''
      items.push({
        id: `webhook-${w.id}`,
        type: 'Erro',
        source: 'webhook',
        description: `Webhook ${w.eventType} falhou${httpFragment} após ${w.attemptCount} tentativa(s)`,
        user: `${tenantLabel}${endpointName}`,
        ip: '—',
        date: w.createdAt.toISOString(),
        createdAt: w.createdAt.toISOString(),
      })
    }

    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    const filtered = search
      ? items.filter(item => {
          const q = search.toLowerCase()
          return (
            item.description.toLowerCase().includes(q) ||
            item.user.toLowerCase().includes(q)
          )
        })
      : items

    const limited = filtered.slice(0, TOTAL_LIMIT)

    res.json({
      success: true,
      data: {
        items: limited,
        period,
        totalReturned: limited.length,
        sources: {
          email: emailLogs.length,
          webhook: webhookDeliveries.length,
        },
      },
    })
    return
  } catch (err: any) {
    console.error('[GET /admin/system-logs] erro:', err?.message ?? err)
    res.status(500).json({
      success: false,
      error: { code: 'SYSTEM_LOGS_FAILED', message: 'Erro ao buscar logs do sistema' },
    })
    return
  }
}
