-- Barred from the full list specifically, regardless of `enabled` (curation)
-- or `providerListedAt` (still stocked upstream). A service can be switched
-- on and blacklisted at once, staying priced and synced while unreachable —
-- that split is the point, not an accident of reusing an existing flag.

ALTER TABLE "services" ADD COLUMN "blacklisted" BOOLEAN NOT NULL DEFAULT false;
