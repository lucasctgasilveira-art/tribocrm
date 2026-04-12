-- Persistent purchase history per lead. The existing leads row only
-- holds the latest closed_value / won_at; this table appends one row
-- per WON transition so "Histórico de compras" in the lead drawer can
-- display every past sale even after the lead is re-won.
CREATE TABLE "lead_purchases" (
  "id"            UUID          NOT NULL,
  "tenant_id"     UUID          NOT NULL,
  "lead_id"       UUID          NOT NULL,
  "closed_value"  DECIMAL(12,2) NOT NULL,
  "won_at"        TIMESTAMP(3)  NOT NULL,
  "product_name"  TEXT,
  "closed_by"     UUID,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_purchases_lead_id_idx" ON "lead_purchases"("lead_id");
CREATE INDEX "lead_purchases_tenant_id_idx" ON "lead_purchases"("tenant_id");

ALTER TABLE "lead_purchases"
  ADD CONSTRAINT "lead_purchases_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "lead_purchases"
  ADD CONSTRAINT "lead_purchases_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
