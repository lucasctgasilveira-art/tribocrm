-- Comissão por faixas progressivas. commissionRate vira nullable
-- (mantido pra compat retroativa — não removo coluna por segurança).
-- commissionTiers (JSONB) recebe array de faixas progressivas:
--   [{ maxClients: 5, rate: 15 }, { maxClients: 19, rate: 20 }, { maxClients: null, rate: 25 }]
-- Engine conta tenants ACTIVE referidos pelo parceiro no momento do
-- charge.paidAt e aplica a faixa correta.
--
-- Migration aditiva e idempotente. Zero impacto em queries existentes.

-- 1. commission_rate vira nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners'
      AND column_name = 'commission_rate'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "partners" ALTER COLUMN "commission_rate" DROP NOT NULL;
  END IF;
END $$;

-- 2. commission_tiers (JSONB) com default array vazio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'commission_tiers'
  ) THEN
    ALTER TABLE "partners" ADD COLUMN "commission_tiers" JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
