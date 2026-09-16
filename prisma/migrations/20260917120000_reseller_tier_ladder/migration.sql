-- The reseller tier ladder.
--
-- Everything here is additive and defaulted, so an existing profile keeps
-- behaving exactly as it did until `reseller_tiers_live` is switched on. The
-- three live rows carry discountPct 15, 15 and 10; those numbers stay where
-- they are and become the record of what each account was on before the ladder.
--
-- tier is deliberately nullable with no default: NULL means normal pricing,
-- which is a real state a reseller can be in, and it must be distinguishable
-- from a profile the nightly evaluation has not reached yet.

ALTER TABLE "reseller_profiles"
  ADD COLUMN "tierMode"         TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "pinnedTier"       TEXT,
  ADD COLUMN "tier"             TEXT,
  ADD COLUMN "tierSince"        TIMESTAMP(3),
  ADD COLUMN "firstMonthEndsAt" TIMESTAMP(3),
  ADD COLUMN "seatForLife"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seatEarnedAt"     TIMESTAMP(3);

CREATE TABLE "reseller_tier_events" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "fromTier"  TEXT,
  "toTier"    TEXT,
  "reason"    TEXT NOT NULL,
  "spendKobo" INTEGER,
  "actor"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reseller_tier_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reseller_tier_events_userId_createdAt_idx"
  ON "reseller_tier_events" ("userId", "createdAt");

ALTER TABLE "reseller_tier_events"
  ADD CONSTRAINT "reseller_tier_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "reseller_profiles" ("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
