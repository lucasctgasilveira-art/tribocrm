-- Tabela de eventos de auditoria do sistema para a UI /admin/logs (Onda 2).
--
-- Populada pelo audit-log.service em modo fire-and-forget — uma falha
-- aqui nunca bloqueia a ação principal (export de CSV, mudança de
-- permissão, etc). Lida pelo system-logs.controller que agrega esses
-- eventos com falhas de EmailLog e WebhookDelivery.
--
-- Diferente da tabela audit_logs (que existe no schema mas nunca foi
-- populada), esta permite tenant_id nulo — necessário pra registrar
-- ações de super-admin que não pertencem a nenhum tenant.
--
-- Idempotente: usa IF NOT EXISTS pra ser segura de reaplicar.

CREATE TABLE IF NOT EXISTS "system_audit_events" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "action"       VARCHAR(80)  NOT NULL,
    "category"     VARCHAR(20)  NOT NULL,
    "actor_type"   VARCHAR(20)  NOT NULL,
    "actor_id"     UUID,
    "actor_email"  VARCHAR(255),
    "tenant_id"    UUID,
    "entity_type"  VARCHAR(50),
    "entity_id"    UUID,
    "ip_address"   VARCHAR(50),
    "metadata"     JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_audit_events_category_created_at_idx"
    ON "system_audit_events" ("category", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "system_audit_events_created_at_idx"
    ON "system_audit_events" ("created_at" DESC);
