ALTER TABLE "orders" ADD COLUMN "nitroStatusAtPurchase" TEXT;
ALTER TABLE "orders" ADD COLUMN "nitroPointsEarnedKobo" INTEGER NOT NULL DEFAULT 0;
