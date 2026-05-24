import type { Request } from 'express'
import { prisma } from '../lib/prisma'

// Helper de auditoria para a UI /admin/logs (Onda 2).
//
// Grava em system_audit_events em modo fire-and-forget: a função
// retorna imediatamente (não aguarda I/O) e qualquer erro é apenas
// logado no console.error — NUNCA quebra a ação principal (export
// de CSV, mudança de permissão etc.).
//
// Mesmo padrão do mailer.service para EmailLog.

export type AuditCategory = 'export' | 'permission'

export type AuditAction =
  | 'EXPORT_LEADS_ADMIN'
  | 'EXPORT_LEADS_TENANT'
  | 'EXPORT_REPORT'
  | 'ADMIN_USER_UPDATED'
  | 'ADMIN_USER_STATUS_CHANGED'
  | 'ADMIN_USER_PASSWORD_RESET'
  | 'ADMIN_USER_DUAL_ACCESS_CHANGED'
  | 'ADMIN_USER_PERMISSIONS_CHANGED'
  | 'TENANT_USER_UPDATED'

export interface AuditLogInput {
  action: AuditAction
  category: AuditCategory
  actorType: 'admin' | 'user'
  actorId?: string | null
  actorEmail?: string | null
  tenantId?: string | null
  entityType?: string | null
  entityId?: string | null
  ipAddress?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Registra um evento de auditoria em background. Sempre retorna
 * imediatamente — chamadas em sequência não bloqueiam.
 *
 * Falhas são silenciadas (console.error apenas) para garantir que
 * nenhum erro de auditoria possa quebrar a ação principal.
 */
export function logAudit(input: AuditLogInput): void {
  ;(async () => {
    try {
      await prisma.systemAuditEvent.create({
        data: {
          action: input.action,
          category: input.category,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail ?? null,
          tenantId: input.tenantId ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          ipAddress: input.ipAddress ?? null,
          metadata: (input.metadata ?? null) as any,
        },
      })
    } catch (err: any) {
      console.error('[AuditLog] falha ao registrar evento:', {
        action: input.action,
        error: err?.message ?? String(err),
      })
    }
  })()
}

/**
 * Extrai o IP do cliente do request Express. Considera proxies
 * (X-Forwarded-For) já tratados por trust proxy do app.
 */
export function getRequestIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.ip ?? req.socket?.remoteAddress ?? null
}
