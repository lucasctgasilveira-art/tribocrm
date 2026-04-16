-- Optional CPF/CNPJ on the tenant row. Captured at checkout when the
-- gestor picks boleto as payment method (Efi requires a customer
-- document on billing_billet charges) and persisted so subsequent
-- boletos don't require re-entry. Nullable because legacy tenants
-- never collected this field and the public signup still doesn't.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "document" VARCHAR(18);
