-- Per-stage active flag for the gestor's "Configurações → Pipeline"
-- toggle. When false, the stage is preserved in the DB (so historical
-- leads still resolve their stageId) but the gestor signals that new
-- leads shouldn't land here. Fixed stages (Venda Realizada / Perdido)
-- are forced to true on every save by the bulk-stages endpoint.
ALTER TABLE "pipeline_stages" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
