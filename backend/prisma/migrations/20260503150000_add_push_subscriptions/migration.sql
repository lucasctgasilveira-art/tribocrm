-- Web Push subscriptions — 1 linha por device do vendedor que aceitou
-- notificações. endpoint+p256dh+auth são gerados pelo navegador via
-- PushManager.subscribe() e enviados ao backend via POST /push/subscribe.
--
-- Migration extra-defensiva: IF NOT EXISTS na tabela e em cada constraint.
-- Idempotente: pode rodar 2x sem efeito colateral. Rollback: DROP TABLE
-- (zero dependência externa).

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID         NOT NULL,
  "endpoint"   TEXT         NOT NULL,
  "p256dh"     TEXT         NOT NULL,
  "auth"       TEXT         NOT NULL,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Unique (user_id, endpoint) — mesmo device do mesmo user só registra 1x.
-- Re-subscribe sobrescreve via INSERT ... ON CONFLICT DO UPDATE no upsert.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_endpoint_key'
  ) THEN
    ALTER TABLE "push_subscriptions"
      ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key"
      UNIQUE ("user_id", "endpoint");
  END IF;
END $$;

-- FK pra users com CASCADE: se o user é deletado, suas subscriptions vão
-- junto (não faz sentido manter push pra user inexistente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE "push_subscriptions"
      ADD CONSTRAINT "push_subscriptions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice pra busca por user_id (usado no envio de push pra todos os
-- devices do user).
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx"
  ON "push_subscriptions"("user_id");
