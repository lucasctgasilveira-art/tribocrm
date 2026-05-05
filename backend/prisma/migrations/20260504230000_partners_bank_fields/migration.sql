-- Adiciona 4 colunas estruturadas pra dados bancários do parceiro
-- (banco, agência, conta, tipo). bank_info continua existindo como
-- "Observações" livres pra compatibilidade.
--
-- Migration aditiva e idempotente. Zero impacto em queries existentes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE "partners" ADD COLUMN "bank_name" VARCHAR(100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'bank_branch'
  ) THEN
    ALTER TABLE "partners" ADD COLUMN "bank_branch" VARCHAR(20);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'bank_account'
  ) THEN
    ALTER TABLE "partners" ADD COLUMN "bank_account" VARCHAR(30);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'bank_account_type'
  ) THEN
    ALTER TABLE "partners" ADD COLUMN "bank_account_type" VARCHAR(20);
  END IF;
END $$;
