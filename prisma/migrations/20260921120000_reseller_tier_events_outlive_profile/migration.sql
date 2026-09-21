-- ResellerTierEvent stops being a real Prisma relation to ResellerProfile.
-- It was one, with ON DELETE CASCADE, until Remove — a plain admin action to
-- take a row off the resellers list, not a purge — was found deleting a
-- reseller's entire ladder history as a side effect. The events are the
-- receipts the schema comment on this table says they are; removing someone
-- from the list is not a reason to burn the record of why they were ever on
-- a rate. userId is kept and still indexed for lookups, just no longer tied
-- to the profile's lifetime.

ALTER TABLE "reseller_tier_events" DROP CONSTRAINT "reseller_tier_events_userId_fkey";
