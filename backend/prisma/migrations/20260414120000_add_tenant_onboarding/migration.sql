-- First-access onboarding wizard state, owned by the tenant (not the
-- user) so reinstalls / cross-device logins see the same progress.
-- Read on login and updated via PATCH /tenants/onboarding.
ALTER TABLE "tenants" ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "onboarding_step" INTEGER NOT NULL DEFAULT 0;

-- Existing tenants are already using the system past the onboarding
-- phase — mark them as completed so MANAGER/OWNER users don't suddenly
-- see the wizard on their next login. Only brand-new tenants created
-- after this migration land on the `false` default and trigger the
-- wizard on their first gestor login.
UPDATE "tenants" SET "onboarding_completed" = true, "onboarding_step" = 3;
