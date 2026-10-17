-- Three schema changes reached production without a migration: the outreach
-- opt-out column on users (v2.2.1), the outreach contact method, and the
-- services.platform index (v2.5.19). Production has all three, so CI's
-- comparison of the migrated database against schema.prisma failed on every
-- push. This records them as a forward migration. IF NOT EXISTS keeps the
-- columns a no-op on production. The index is rebuilt as the plain index the
-- schema declares: production's was partial (WHERE platform IS NOT NULL),
-- which Prisma does not count as @@index([platform]).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "outreachOptedOutAt" TIMESTAMP(3);

ALTER TABLE "outreach_contacts" ADD COLUMN IF NOT EXISTS "method" TEXT;

DROP INDEX IF EXISTS "services_platform_idx";
CREATE INDEX "services_platform_idx" ON "services"("platform");
