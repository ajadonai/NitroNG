-- Which New Order tile sells a service, cached from lib/full-catalogue platformOf.
-- Derived from the service name; stored only so the full list can filter on it in
-- SQL rather than reading all 9,820 fenced rows and grouping them in memory.
ALTER TABLE "services" ADD COLUMN "platform" TEXT;

-- Partial index: the full list only ever asks for rows that have one, and about
-- a fifth of the table does not (VK, Rubika, GitHub — platforms with no tile).
CREATE INDEX "services_platform_idx" ON "services"("platform") WHERE "platform" IS NOT NULL;
