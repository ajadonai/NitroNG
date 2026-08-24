-- Reseller-facing IDs are permanent commitments, so the mapping table must not
-- be able to break under it: rows retire instead of being deleted, deleting a
-- referenced tier or service is refused at the database, and a row pointing at
-- nothing (or at both a tier and a service) is unrepresentable.

-- DropForeignKey
ALTER TABLE "reseller_service_map" DROP CONSTRAINT "reseller_service_map_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "reseller_service_map" DROP CONSTRAINT "reseller_service_map_tierId_fkey";

-- AlterTable
ALTER TABLE "reseller_service_map" ADD COLUMN     "retiredAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "reseller_service_map" ADD CONSTRAINT "reseller_service_map_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "service_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_service_map" ADD CONSTRAINT "reseller_service_map_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one target. Not expressible in Prisma schema; enforced here.
ALTER TABLE "reseller_service_map" ADD CONSTRAINT "reseller_service_map_one_target"
  CHECK ((("tierId" IS NOT NULL)::int + ("serviceId" IS NOT NULL)::int) = 1);
