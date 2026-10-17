-- Three schema changes reached production without a migration: the outreach
-- opt-out column on users (v2.2.1), the outreach contact method, and the
-- services.platform index (v2.5.19). Production has all three, so CI's
-- comparison of the migrated database against schema.prisma failed on every
-- push. This records them as a forward migration. IF NOT EXISTS keeps it a
-- no-op on production; the index matches production's own definition, which
-- is partial.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "outreachOptedOutAt" TIMESTAMP(3);

ALTER TABLE "outreach_contacts" ADD COLUMN IF NOT EXISTS "method" TEXT;

CREATE INDEX IF NOT EXISTS "services_platform_idx" ON "services"("platform") WHERE "platform" IS NOT NULL;
