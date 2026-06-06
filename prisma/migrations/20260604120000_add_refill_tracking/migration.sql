-- AlterTable: add completedAt to orders
ALTER TABLE "orders" ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable: add refillDays to service_tiers
ALTER TABLE "service_tiers" ADD COLUMN "refillDays" INTEGER NOT NULL DEFAULT 0;

-- Backfill: set completedAt from updatedAt for existing completed orders
UPDATE "orders" SET "completedAt" = "updatedAt" WHERE "status" = 'Completed' AND "completedAt" IS NULL;

-- Backfill: set refillDays to 30 for tiers that have refill enabled
UPDATE "service_tiers" SET "refillDays" = 30 WHERE "refill" = true AND "refillDays" = 0;
