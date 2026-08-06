-- AlterTable
ALTER TABLE "service_tiers" ADD COLUMN "trafficTargeting" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "trafficConfig" JSONB;
