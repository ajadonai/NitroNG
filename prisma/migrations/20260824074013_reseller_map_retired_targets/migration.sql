-- A retired mapping keeps only its ID and retirement date: repointing it at the
-- tier's underlying service could collide with that service's own full-catalogue
-- mapping (serviceId is unique), and holding the tier FK would make the RESTRICT
-- rule block the very deletion the retirement exists to allow. Live rows still
-- require exactly one target.
ALTER TABLE "reseller_service_map" DROP CONSTRAINT "reseller_service_map_one_target";
ALTER TABLE "reseller_service_map" ADD CONSTRAINT "reseller_service_map_one_target"
  CHECK ("retiredAt" IS NOT NULL OR ((("tierId" IS NOT NULL)::int + ("serviceId" IS NOT NULL)::int) = 1));
