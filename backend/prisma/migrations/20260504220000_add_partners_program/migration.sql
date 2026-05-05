-- Programa de parceiros (afiliados/agências). Tenant indicado paga →
-- cobrança vira PAID → comissão é gerada pro parceiro com 30 dias de
-- carência. Sem reversão depois da carência. Histórico de trocas em
-- tenant_partner_changes.
--
-- Migration extra-defensiva: IF NOT EXISTS em tudo. Idempotente.
-- Aditiva: 3 tabelas novas + 2 colunas nullable em tenants. Zero
-- impacto em queries existentes.
-- Rollback: ALTER TABLE tenants DROP COLUMN ...; DROP TABLE ...;

-- ────────────────────────────────────────────────────────────
-- partners
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "partners" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"            VARCHAR(150) NOT NULL,
  "email"           VARCHAR(255) NOT NULL,
  "document"        VARCHAR(18),
  "phone"           VARCHAR(20),
  "pix_key"         VARCHAR(150),
  "bank_info"       TEXT,
  "code"            VARCHAR(20)  NOT NULL,
  "commission_rate" DECIMAL(5,2) NOT NULL,
  "is_active"       BOOLEAN      NOT NULL DEFAULT true,
  "notes"           TEXT,
  "created_by"      UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partners_code_key'
  ) THEN
    ALTER TABLE "partners" ADD CONSTRAINT "partners_code_key" UNIQUE ("code");
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- tenants — colunas novas (nullable, zero impacto em queries antigas)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'referred_by_partner_id'
  ) THEN
    ALTER TABLE "tenants" ADD COLUMN "referred_by_partner_id" UUID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'referred_at'
  ) THEN
    ALTER TABLE "tenants" ADD COLUMN "referred_at" TIMESTAMP(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_referred_by_partner_id_fkey'
  ) THEN
    ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_referred_by_partner_id_fkey"
      FOREIGN KEY ("referred_by_partner_id") REFERENCES "partners"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tenants_referred_by_partner_id_idx"
  ON "tenants"("referred_by_partner_id");

-- ────────────────────────────────────────────────────────────
-- partner_commissions
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "partner_commissions" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "partner_id"   UUID         NOT NULL,
  "tenant_id"    UUID         NOT NULL,
  "charge_id"    UUID         NOT NULL,
  "amount"       DECIMAL(12,2) NOT NULL,
  "rate"         DECIMAL(5,2)  NOT NULL,
  "commission"   DECIMAL(12,2) NOT NULL,
  "status"       VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  "available_at" TIMESTAMP(3)  NOT NULL,
  "paid_at"      TIMESTAMP(3),
  "reversed_at"  TIMESTAMP(3),
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_commissions_charge_id_key'
  ) THEN
    ALTER TABLE "partner_commissions"
      ADD CONSTRAINT "partner_commissions_charge_id_key" UNIQUE ("charge_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_commissions_partner_id_fkey'
  ) THEN
    ALTER TABLE "partner_commissions"
      ADD CONSTRAINT "partner_commissions_partner_id_fkey"
      FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_commissions_tenant_id_fkey'
  ) THEN
    ALTER TABLE "partner_commissions"
      ADD CONSTRAINT "partner_commissions_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "partner_commissions_partner_id_status_idx"
  ON "partner_commissions"("partner_id", "status");
CREATE INDEX IF NOT EXISTS "partner_commissions_status_available_at_idx"
  ON "partner_commissions"("status", "available_at");
CREATE INDEX IF NOT EXISTS "partner_commissions_tenant_id_idx"
  ON "partner_commissions"("tenant_id");

-- ────────────────────────────────────────────────────────────
-- tenant_partner_changes
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tenant_partner_changes" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID         NOT NULL,
  "old_partner_id" UUID,
  "new_partner_id" UUID,
  "changed_by"     UUID,
  "source"         VARCHAR(30)  NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_partner_changes_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_partner_changes_tenant_id_fkey'
  ) THEN
    ALTER TABLE "tenant_partner_changes"
      ADD CONSTRAINT "tenant_partner_changes_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_partner_changes_old_partner_id_fkey'
  ) THEN
    ALTER TABLE "tenant_partner_changes"
      ADD CONSTRAINT "tenant_partner_changes_old_partner_id_fkey"
      FOREIGN KEY ("old_partner_id") REFERENCES "partners"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_partner_changes_new_partner_id_fkey'
  ) THEN
    ALTER TABLE "tenant_partner_changes"
      ADD CONSTRAINT "tenant_partner_changes_new_partner_id_fkey"
      FOREIGN KEY ("new_partner_id") REFERENCES "partners"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_partner_changes_changed_by_fkey'
  ) THEN
    ALTER TABLE "tenant_partner_changes"
      ADD CONSTRAINT "tenant_partner_changes_changed_by_fkey"
      FOREIGN KEY ("changed_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tenant_partner_changes_tenant_id_created_at_idx"
  ON "tenant_partner_changes"("tenant_id", "created_at" DESC);
