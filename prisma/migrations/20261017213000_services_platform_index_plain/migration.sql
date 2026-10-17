-- services_platform_idx as the plain index schema.prisma declares.
-- 20261017160000_reconcile_schema_drift recorded production's own definition,
-- which is partial (WHERE platform IS NOT NULL), and Prisma does not count a
-- partial index as @@index([platform]), so CI's schema comparison still failed.
-- That migration was already applied and its SQL is immutable, so the rebuild
-- happens here instead.

DROP INDEX IF EXISTS "services_platform_idx";
CREATE INDEX "services_platform_idx" ON "services"("platform");
