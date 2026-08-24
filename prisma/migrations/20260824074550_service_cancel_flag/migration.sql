-- Providers return a cancel flag per service; we never stored it. The reseller
-- catalogue and API need it, since full-list services carry provider terms only.
ALTER TABLE "services" ADD COLUMN "cancel" BOOLEAN NOT NULL DEFAULT false;
