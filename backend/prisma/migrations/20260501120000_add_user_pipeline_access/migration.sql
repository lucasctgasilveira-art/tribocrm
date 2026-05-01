-- Tabela de junção many-to-many entre users e pipelines.
-- OWNER ignora essa tabela (vê tudo via shortcut no controller).
-- MANAGER/TEAM_LEADER/SELLER são filtrados por linhas aqui.
--
-- Backfill: cada usuário não-OWNER existente recebe linha pra
-- cada pipeline ativa do mesmo tenant. Garante que ninguém
-- perde acesso ao que já tinha após o deploy.

-- ── 1. Cria tabela ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_pipeline_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pipeline_access_pkey" PRIMARY KEY ("id")
);

-- ── 2. Constraints e indices ────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "user_pipeline_access_user_id_pipeline_id_key"
    ON "user_pipeline_access"("user_id", "pipeline_id");

CREATE INDEX IF NOT EXISTS "user_pipeline_access_tenant_id_idx"
    ON "user_pipeline_access"("tenant_id");

ALTER TABLE "user_pipeline_access"
    ADD CONSTRAINT "user_pipeline_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_pipeline_access"
    ADD CONSTRAINT "user_pipeline_access_pipeline_id_fkey"
    FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. Backfill ─────────────────────────────────────────────────
-- Insere uma linha pra cada (user não-OWNER, pipeline ativa) do
-- mesmo tenant. ON CONFLICT é defesa contra reexecução acidental.
INSERT INTO "user_pipeline_access" ("id", "tenant_id", "user_id", "pipeline_id", "created_at")
SELECT
    gen_random_uuid(),
    u.tenant_id,
    u.id,
    p.id,
    NOW()
FROM "users" u
JOIN "pipelines" p ON p.tenant_id = u.tenant_id AND p.is_active = true
WHERE u.role <> 'OWNER'
  AND u.deleted_at IS NULL
ON CONFLICT ("user_id", "pipeline_id") DO NOTHING;
