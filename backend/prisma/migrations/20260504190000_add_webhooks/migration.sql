-- Webhook endpoints (saída) do TriboCRM. Cada tenant cadastra N endpoints
-- pra receber POSTs quando eventos acontecem (lead.created, lead.won etc.).
-- WebhookDelivery é o log de cada tentativa de entrega (com retry).
--
-- Migration extra-defensiva: IF NOT EXISTS em tudo. Idempotente.
-- Rollback: DROP TABLE webhook_deliveries; DROP TABLE webhook_endpoints;

-- ────────────────────────────────────────────────────────────
-- webhook_endpoints
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID         NOT NULL,
  "name"       VARCHAR(100) NOT NULL,
  "url"        TEXT         NOT NULL,
  "secret"     VARCHAR(80)  NOT NULL,
  "events"     TEXT[]       NOT NULL DEFAULT '{}',
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_endpoints_tenant_id_fkey'
  ) THEN
    ALTER TABLE "webhook_endpoints"
      ADD CONSTRAINT "webhook_endpoints_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_endpoints_created_by_fkey'
  ) THEN
    ALTER TABLE "webhook_endpoints"
      ADD CONSTRAINT "webhook_endpoints_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "webhook_endpoints_tenant_id_idx"
  ON "webhook_endpoints"("tenant_id");

-- ────────────────────────────────────────────────────────────
-- webhook_deliveries
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"             UUID         NOT NULL,
  "endpoint_id"           UUID         NOT NULL,
  "event_type"            VARCHAR(50)  NOT NULL,
  "payload"               JSONB        NOT NULL,
  "status"                VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  "attempt_count"         INTEGER      NOT NULL DEFAULT 0,
  "last_response_status"  INTEGER,
  "last_response_body"    TEXT,
  "last_error"            TEXT,
  "next_retry_at"         TIMESTAMP(3),
  "delivered_at"          TIMESTAMP(3),
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_deliveries_endpoint_id_fkey'
  ) THEN
    ALTER TABLE "webhook_deliveries"
      ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey"
      FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice composto pra listagem na UI (logs do tenant ordenados desc).
CREATE INDEX IF NOT EXISTS "webhook_deliveries_tenant_id_created_at_idx"
  ON "webhook_deliveries"("tenant_id", "created_at" DESC);

-- Índice pra cron de retry (status=PENDING + next_retry_at <= now()).
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_next_retry_at_idx"
  ON "webhook_deliveries"("status", "next_retry_at");
