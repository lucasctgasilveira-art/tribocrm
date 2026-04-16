-- Password-reset flow. When the gestor hits POST /public/forgot-password
-- the controller stamps these two columns with a UUID + 1h expiry; the
-- /public/reset-password endpoint consumes them atomically. Indexed on
-- the token for fast lookup during reset.
ALTER TABLE "users" ADD COLUMN "password_reset_token" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" TIMESTAMP(3);

CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");
