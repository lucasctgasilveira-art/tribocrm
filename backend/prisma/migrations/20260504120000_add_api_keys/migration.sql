-- API keys da v1 da API pública. Tenant cria N keys, cada uma com hash
-- SHA-256 (key real nunca armazenada em texto plano). Soft-delete via
-- revokedAt. createdBy é SET NULL pra preservar auditoria mesmo se o
-- user que criou for removido.
--
-- Migration extra-defensiva: IF NOT EXISTS na tabela e em cada
-- constraint. Idempotente: pode rodar 2x sem efeito colateral.
-- Rollback: DROP TABLE (zero dependência externa fora de tenants/users).

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID         NOT NULL,
  "name"         VARCHAR(100) NOT NULL,
  "key_hash"     VARCHAR(64)  NOT NULL,
  "key_prefix"   VARCHAR(20)  NOT NULL,
  "last_used_at" TIMESTAMP(3),
  "revoked_at"   TIMESTAMP(3),
  "created_by"   UUID,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- Unique do hash — duas keys nunca podem colidir (probabilisticamente
-- impossível com SHA-256 + 32 bytes random, mas a constraint formaliza).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_key_hash_key'
  ) THEN
    ALTER TABLE "api_keys"
      ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");
  END IF;
END $$;

-- FK pra tenants com CASCADE (deletar tenant remove suas keys).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_tenant_id_fkey'
  ) THEN
    ALTER TABLE "api_keys"
      ADD CONSTRAINT "api_keys_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK pra users com SET NULL (preservar key se user for removido).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_created_by_fkey'
  ) THEN
    ALTER TABLE "api_keys"
      ADD CONSTRAINT "api_keys_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice por tenant_id pra listagem na tela de gestão.
CREATE INDEX IF NOT EXISTS "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");
