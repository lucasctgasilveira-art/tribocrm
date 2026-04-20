-- Sub-etapa 6J.2: card subscription fields on Tenant and Charge.
-- Adds the columns the recurring-card flow (efi subscription id,
-- card metadata, next billing date) will populate once 6J.3 wires
-- the service layer. Strictly additive — no DROP, no ALTER COLUMN.
-- Every statement uses IF NOT EXISTS so re-running the migration
-- is a safe no-op.

-- AlterTable: tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "efi_subscription_id" VARCHAR(100);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "efi_subscription_status" VARCHAR(20);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "card_last_four" VARCHAR(4);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "card_brand" VARCHAR(20);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "card_expires_at" DATE;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "next_billing_at" TIMESTAMP(3);

-- AlterTable: charges
ALTER TABLE "charges" ADD COLUMN IF NOT EXISTS "efi_subscription_id" VARCHAR(100);
