-- Reconciliação de drift entre staging e produção
--
-- Contexto: staging foi reconstruído via pg_dump em 24/04/2026 e ficou
-- com 4 indexes + 4 FKs ausentes que existem em produção. Esta migration
-- adiciona-os de forma idempotente para que ambos ambientes fiquem
-- alinhados ao schema.prisma.
--
-- Em produção é no-op (todos os itens já existem).
-- Em staging adiciona o que falta.

-- ════════════════════════════════════════════════════════════
-- INDEXES (idempotente via IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "lead_purchases_lead_id_idx"
  ON "lead_purchases"("lead_id");

CREATE INDEX IF NOT EXISTS "lead_purchases_tenant_id_idx"
  ON "lead_purchases"("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_users_email_verification_token"
  ON "users"("email_verification_token");

CREATE INDEX IF NOT EXISTS "idx_users_password_reset_token"
  ON "users"("password_reset_token");

-- ════════════════════════════════════════════════════════════
-- FOREIGN KEYS (idempotente via DO block)
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_purchases_lead_id_fkey'
  ) THEN
    ALTER TABLE "lead_purchases"
      ADD CONSTRAINT "lead_purchases_lead_id_fkey"
      FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
      ON UPDATE CASCADE ON DELETE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_purchases_tenant_id_fkey'
  ) THEN
    ALTER TABLE "lead_purchases"
      ADD CONSTRAINT "lead_purchases_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON UPDATE CASCADE ON DELETE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_created_by_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON UPDATE CASCADE ON DELETE NO ACTION;
  END IF;
END $$;

-- NOTA: managerial_tasks.created_by NÃO recebe FK (intencional,
-- ver comentário no schema.prisma model ManagerialTask).

-- ════════════════════════════════════════════════════════════
-- email_verified NOT NULL
--
-- Em produção: 0 linhas com NULL (validado em 24/04/2026)
-- Em staging: 0 linhas com NULL (banco recém-clonado)
-- Default = false, código nunca passa NULL
-- ════════════════════════════════════════════════════════════

UPDATE "users" SET "email_verified" = false WHERE "email_verified" IS NULL;
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;
