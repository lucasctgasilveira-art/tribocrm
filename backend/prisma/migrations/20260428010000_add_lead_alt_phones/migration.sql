-- Adiciona campo alt_phones (telefones alternativos do lead)
-- Tipo: JSONB com default array vazio
-- Usado pela extensão Chrome para guardar telefones detectados
-- além do principal/whatsapp

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "alt_phones" JSONB NOT NULL DEFAULT '[]';
