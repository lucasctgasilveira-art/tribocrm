-- Recover schema drift: columns that exist in schema.prisma but were
-- never backed by versioned migrations. Production acquired them via
-- manual ALTER TABLE done outside Prisma history; staging (which was
-- DROP SCHEMA'd and only applies versioned migrations) was missing
-- them. IF NOT EXISTS keeps this migration idempotent across both
-- environments — no-op in prod, brings staging back in sync.
--
-- 17 columns on `tenants` (3 logical batches: identidade, desconto,
-- perfil + endereço) and 1 column on `users` (`user_status`). Types
-- mirror the schema.prisma declarations exactly; @db.VarChar(N) maps
-- to VARCHAR(N), @db.Text to TEXT, @db.Date to DATE, DateTime without
-- @db.Date to TIMESTAMP(3) (project convention — matches every prior
-- migration in this folder), Decimal to DECIMAL with the same
-- precision/scale, Int to INTEGER. All `tenants` columns are nullable
-- (matching the `?` in schema). `user_status` is NOT NULL with
-- default 'ACTIVE' so existing rows backfill safely.

-- ─── tenants: identidade ─────────────────────────────────────
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trade_name" VARCHAR(150);

-- ─── tenants: descontos comerciais ───────────────────────────
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "discount_type"   VARCHAR(20);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "discount_value"  DECIMAL(10,2);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "discount_from"   TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "discount_until"  TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "discount_cycles" INTEGER;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "discount_reason" TEXT;

-- ─── tenants: perfil empresa ─────────────────────────────────
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "site"             VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "responsible_name" VARCHAR(150);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "founded_at"       DATE;

-- ─── tenants: endereço ───────────────────────────────────────
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_street"       VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_number"       VARCHAR(20);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_complement"   VARCHAR(150);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_neighborhood" VARCHAR(150);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_city"         VARCHAR(150);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_state"        VARCHAR(2);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address_zip"          VARCHAR(10);

-- ─── users: status ───────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
