-- Sub-etapa 6A: billing state machine foundation.
-- Adds PAYMENT_OVERDUE to the TenantStatus enum and two fields to
-- tenants that the pre-billing / overdue / suspension jobs will use
-- for idempotency. Strictly additive — no DROP, no ALTER COLUMN.
-- Every statement uses IF NOT EXISTS so re-running the migration is
-- a safe no-op (defensive in case of partial apply recovery).

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_OVERDUE';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "last_billing_state" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "last_billing_state_at" TIMESTAMP(3);
