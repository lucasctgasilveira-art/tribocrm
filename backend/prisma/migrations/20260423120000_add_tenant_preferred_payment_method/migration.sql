-- CreateEnum
CREATE TYPE "PreferredPaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "preferred_payment_method" "PreferredPaymentMethod";
