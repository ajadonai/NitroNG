-- providerListedAt: whether the provider still lists a service, kept apart from
-- `enabled`, which is Nitro's own decision to stock it. Nullable so the backfill
-- happens on the next sync rather than guessing here.
-- discountPct: per-reseller override of the global wholesale rate. Null means the
-- global setting applies.
ALTER TABLE "reseller_profiles" ADD COLUMN     "discountPct" INTEGER;
ALTER TABLE "services" ADD COLUMN     "providerListedAt" TIMESTAMP(3);
