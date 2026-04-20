-- Sub-etapa 6L.1.a: persistent log of email attempts.
-- Every Brevo send (sendMail / sendTemplateMail) writes one row
-- here via fire-and-forget from mailer.service. Surfaces in the
-- super-admin UI for ops debugging. Strictly additive — new table
-- only. IF NOT EXISTS guards make re-runs safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "to_email" VARCHAR(255) NOT NULL,
  "template_id" INTEGER,
  "subject" VARCHAR(255),
  "status" VARCHAR(30) NOT NULL,
  "brevo_message_id" VARCHAR(150),
  "error_reason" VARCHAR(50),
  "error_details" TEXT,
  "params_json" JSONB,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_logs_tenant_id_sent_at_idx"
  ON "email_logs"("tenant_id", "sent_at" DESC);

CREATE INDEX IF NOT EXISTS "email_logs_status_sent_at_idx"
  ON "email_logs"("status", "sent_at" DESC);
