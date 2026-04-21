-- Sub-etapa 6L.3.a: background-processed email campaigns.
-- Created in PENDING by POST /admin/campaign/send and picked up
-- by the campaign-runner cron. Frees HTTP requests from the
-- timeout that capped the synchronous 6L.2 MVP at ~500 recipients.
-- Strictly additive — new table only. IF NOT EXISTS guards make
-- re-runs safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" UUID NOT NULL,
  "template_id" INTEGER NOT NULL,
  "params_json" JSONB NOT NULL,
  "audience" VARCHAR(20) NOT NULL,
  "filters_json" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "total_recipients" INTEGER NOT NULL DEFAULT 0,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_by" UUID,

  CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_campaigns_status_created_at_idx"
  ON "email_campaigns"("status", "created_at" DESC);
