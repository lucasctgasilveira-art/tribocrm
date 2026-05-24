import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// GET /admin/system-logs
//
// Agrega eventos de log de várias fontes em um formato unificado pra
// UI de "Logs do Sistema". É read-only — não escreve em nenhuma tabela.
//
// Onda 1: falhas reais de EmailLog e WebhookDelivery (tipo "Erro").
// Onda 2: eventos de SystemAuditEvent (tipos "Exportação" e "Permissão").
// Futuro (Onda 3): logins, rate limit.

type Period = 'today' | '24h' | '7d' | '30d' | 'all'

type LogTypeLabel = 'Erro' | 'Exportação' | 'Permissão'

interface UnifiedLogItem {
  id: string
  type: LogTypeLabel
  source: 'email' | 'webhook' | 'audit'
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

// Mapeia o action técnico do audit log pra uma descrição PT-BR amigável
// pra exibir na UI. A `metadata` é JSONB livre por audit; aqui só usamos
// chaves conhecidas (filename, fieldsChanged etc).
function describeAuditEvent(
  action: string,
  metadata: Record<string, unknown> | null,
): string {
  const meta = (metadata ?? {}) as Record<string, unknown>
  switch (action) {
    case 'EXPORT_LEADS_ADMIN':
      return `Exportou lista consolidada de leads (${meta.rowCount ?? '?'} registros)`
    case 'EXPORT_LEADS_TENANT':
      return `Exportou leads em ${String(meta.format ?? '?').toUpperCase()} (${meta.rowCount ?? '?'} registros)`
    case 'EXPORT_REPORT':
      return `Exportou relatório (${meta.reportType ?? 'tipo desconhecido'})`
    case 'ADMIN_USER_UPDATED': {
      const fields = Array.isArray(meta.fieldsChanged) ? (meta.fieldsChanged as string[]).join(', ') : ''
      return `Atualizou membro da equipe interna${fields ? ` (${fields})` : ''}`
    }
    case 'ADMIN_USER_STATUS_CHANGED':
      return meta.newIsActive
        ? 'Reativou membro da equipe interna'
        : 'Desativou membro da equipe interna'
    case 'ADMIN_USER_PASSWORD_RESET':
      return 'Resetou senha de membro da equipe interna'
    case 'ADMIN_USER_DUAL_ACCESS_CHANGED':
      return meta.newIsDualAccess
        ? 'Concedeu acesso duplo a membro'
        : 'Revogou acesso duplo de membro'
    case 'ADMIN_USER_PERMISSIONS_CHANGED':
      return 'Alterou permissões customizadas de membro'
    case 'TENANT_USER_UPDATED': {
      const fields = Array.isArray(meta.fieldsChanged) ? (meta.fieldsChanged as string[]).join(', ') : ''
      return `Atualizou usuário do time${fields ? ` (${fields})` : ''}`
    }
    default:
      return action
  }
}

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

    const auditWhere: any = {}
    if (periodStart) auditWhere.createdAt = { gte: periodStart }

    const [emailLogs, webhookDeliveries, auditEvents] = await Promise.all([
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
      prisma.systemAuditEvent.findMany({
        where: auditWhere,
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
        select: {
          id: true,
          action: true,
          category: true,
          actorType: true,
          actorId: true,
          actorEmail: true,
          tenantId: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ])

    // Coleta tenantIds e actorIds (admin) e actorIds (user) pra lookup
    // em uma única consulta cada — evita N+1.
    const tenantIds = new Set<string>()
    const adminActorIds = new Set<string>()
    const userActorIds = new Set<string>()

    for (const e of emailLogs) if (e.tenantId) tenantIds.add(e.tenantId)
    for (const w of webhookDeliveries) if (w.tenantId) tenantIds.add(w.tenantId)
    for (const a of auditEvents) {
      if (a.tenantId) tenantIds.add(a.tenantId)
      if (a.actorId) {
        if (a.actorType === 'admin') adminActorIds.add(a.actorId)
        else userActorIds.add(a.actorId)
      }
    }

    const [tenants, adminUsers, tenantUsers] = await Promise.all([
      tenantIds.size
        ? prisma.tenant.findMany({
            where: { id: { in: Array.from(tenantIds) } },
            select: { id: true, name: true, tradeName: true },
          })
        : Promise.resolve([]),
      adminActorIds.size
        ? prisma.adminUser.findMany({
            where: { id: { in: Array.from(adminActorIds) } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      userActorIds.size
        ? prisma.user.findMany({
            where: { id: { in: Array.from(userActorIds) } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ])

    const tenantById = new Map(tenants.map(t => [t.id, t]))
    const adminById = new Map(adminUsers.map(u => [u.id, u]))
    const userById = new Map(tenantUsers.map(u => [u.id, u]))

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

    for (const a of auditEvents) {
      const type: LogTypeLabel = a.category === 'export' ? 'Exportação' : 'Permissão'

      // Constrói label do usuário: prefere actorEmail; cai pra lookup
      // por id; cai pra "(ator desconhecido)" se nada bater.
      let actorLabel = a.actorEmail ?? null
      if (!actorLabel && a.actorId) {
        const found = a.actorType === 'admin' ? adminById.get(a.actorId) : userById.get(a.actorId)
        if (found) actorLabel = found.email
      }
      if (!actorLabel) actorLabel = '(ator desconhecido)'

      // Tenant context (gestor tenant) ou prefix de plataforma (admin).
      let userLabel: string
      if (a.actorType === 'admin') {
        userLabel = `Admin: ${actorLabel}`
      } else {
        const tenant = a.tenantId ? tenantById.get(a.tenantId) : null
        const tenantLabel = tenant ? (tenant.tradeName || tenant.name) : 'Sem tenant'
        userLabel = `${tenantLabel} → ${actorLabel}`
      }

      items.push({
        id: `audit-${a.id}`,
        type,
        source: 'audit',
        description: describeAuditEvent(a.action, (a.metadata ?? null) as Record<string, unknown> | null),
        user: userLabel,
        ip: a.ipAddress ?? '—',
        date: a.createdAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
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
          audit: auditEvents.length,
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
