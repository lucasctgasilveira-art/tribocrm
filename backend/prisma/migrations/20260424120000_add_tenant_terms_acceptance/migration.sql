-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "terms_version" VARCHAR(10),
ADD COLUMN     "privacy_accepted_at" TIMESTAMP(3),
ADD COLUMN     "privacy_version" VARCHAR(10);
