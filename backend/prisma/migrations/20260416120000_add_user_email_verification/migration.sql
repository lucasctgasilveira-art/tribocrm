-- Email verification for the public signup flow. New users created
-- via POST /public/signup land with email_verified=false and a
-- non-null token that gets consumed by GET /public/verify-email. The
-- auth middleware refuses unverified users with HTTP 403.
--
-- Existing users created before this migration (seeded, admin-created
-- via POST /users, or imported) are backfilled to verified=true so
-- their sessions keep working without any manual step.
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_verification_token" VARCHAR(100);

UPDATE "users" SET "email_verified" = true WHERE "created_at" < NOW();

CREATE INDEX "users_email_verification_token_idx" ON "users"("email_verification_token");
