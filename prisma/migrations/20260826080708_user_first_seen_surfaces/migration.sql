-- Onboarding funnel: when a user first opened the Wallet and the New Order page.
ALTER TABLE users ADD COLUMN "firstSeenWalletAt" TIMESTAMP(3);
ALTER TABLE users ADD COLUMN "firstSeenNewOrderAt" TIMESTAMP(3);
