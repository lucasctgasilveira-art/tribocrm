-- Adiciona campo title (opcional) na tabela Popup.
--
-- Permite ao super admin cadastrar título customizado por pop-up
-- (ex: "Black Friday — 30% OFF"). Quando NULL, o frontend usa
-- fallback derivado do tipo. Migração aditiva, retrocompatível.
--
-- Defensiva: a tabela Popup foi originalmente criada via `db push`,
-- então protege contra estado inconsistente entre migrations e DB real.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Popup'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Popup' AND column_name = 'title'
  ) THEN
    ALTER TABLE "Popup" ADD COLUMN "title" TEXT;
  END IF;
END $$;
