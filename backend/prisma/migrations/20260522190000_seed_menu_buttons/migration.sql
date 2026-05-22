-- Popula tabela menu_buttons com os 2 botões fixos do produto (Mentoria
-- e Treinamentos). O enum MenuButtonType limita os tipos possíveis a
-- esses 2, então o admin só edita label/url/order/isActive — não cria
-- novos tipos. URLs iniciais espelham o hardcode antigo do frontend.
--
-- Idempotente: só insere se o tipo ainda não existir. Roda com segurança
-- mesmo se a tabela já tiver dados (ex: alguém populou manualmente).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_buttons'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM menu_buttons WHERE type = 'MENTORIA') THEN
      INSERT INTO menu_buttons (id, type, label, url, is_active, "order", updated_at)
      VALUES (gen_random_uuid(), 'MENTORIA', 'Mentoria', 'https://mentoria.tribodevendas.com.br', true, 1, NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM menu_buttons WHERE type = 'TREINAMENTOS') THEN
      INSERT INTO menu_buttons (id, type, label, url, is_active, "order", updated_at)
      VALUES (gen_random_uuid(), 'TREINAMENTOS', 'Treinamentos', 'https://treinamentos.tribodevendas.com.br', true, 2, NOW());
    END IF;
  END IF;
END $$;
