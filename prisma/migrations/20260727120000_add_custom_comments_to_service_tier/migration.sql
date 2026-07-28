-- AlterTable
ALTER TABLE "service_tiers" ADD COLUMN IF NOT EXISTS "customComments" BOOLEAN NOT NULL DEFAULT false;
