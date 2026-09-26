-- The order history card only ever had two ways to identify a full-list
-- service: the provider's own apiId (which we should not be handing to a
-- customer to read out over WhatsApp) or Service.id, a cuid meant for the
-- database rather than a person. Neither is what "the actual number" means.
--
-- This adds a real sequential integer, assigned once and never reassigned,
-- backfilled in creation order so history lines up with when each row was
-- actually synced in. A future service picks up the next number automatically
-- via the sequence created below; nothing about this column changes when a
-- service is later blacklisted or dropped by its provider — that stays a
-- separate, mutable fact (services.blacklisted, providerListedAt), shown as a
-- status tag next to the permanent number rather than folded into it.

ALTER TABLE "services" ADD COLUMN "nitroId" INTEGER;

UPDATE "services" s
SET "nitroId" = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "services"
) ordered
WHERE s.id = ordered.id;

CREATE SEQUENCE services_nitroid_seq OWNED BY "services"."nitroId";
SELECT setval('services_nitroid_seq', COALESCE((SELECT MAX("nitroId") FROM "services"), 0));
ALTER TABLE "services" ALTER COLUMN "nitroId" SET DEFAULT nextval('services_nitroid_seq');
ALTER TABLE "services" ALTER COLUMN "nitroId" SET NOT NULL;
CREATE UNIQUE INDEX "services_nitroId_key" ON "services"("nitroId");
