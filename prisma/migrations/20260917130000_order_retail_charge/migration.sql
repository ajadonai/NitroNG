-- What an order would have cost at the site price, when wholesale took it below.
--
-- The reseller ladder measures spend retail-equivalent, so that a promoted
-- reseller does not measure slower the better it does. Reconstructing it by
-- dividing `charge` back out needs the rate that was in force on the day, and
-- nothing stored that — so it is recorded at order time instead.
--
-- Null on every existing row and on every retail order, where `charge` already
-- is the retail figure. That understates the three pre-ladder resellers by the
-- 10-15% they were getting, which is the conservative direction: it makes a
-- rung slightly harder to reach, never easier.

ALTER TABLE "orders" ADD COLUMN "retailCharge" INTEGER;
