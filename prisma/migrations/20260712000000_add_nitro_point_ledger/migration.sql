CREATE TABLE "nitro_point_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pointsKobo" INTEGER NOT NULL,
    "dedupeKey" TEXT,
    "orderId" TEXT,
    "transactionId" TEXT,
    "statusAtEvent" TEXT,
    "pointRateAtEvent" DOUBLE PRECISION,
    "eligibleSpendKobo" INTEGER,
    "reason" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nitro_point_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nitro_point_ledger_dedupeKey_key" ON "nitro_point_ledger"("dedupeKey");
CREATE INDEX "nitro_point_ledger_userId_idx" ON "nitro_point_ledger"("userId");
CREATE INDEX "nitro_point_ledger_userId_type_idx" ON "nitro_point_ledger"("userId", "type");
CREATE INDEX "nitro_point_ledger_createdAt_idx" ON "nitro_point_ledger"("createdAt");

ALTER TABLE "nitro_point_ledger" ADD CONSTRAINT "nitro_point_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "nitro_point_ledger" ADD CONSTRAINT "nitro_point_ledger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nitro_point_ledger" ADD CONSTRAINT "nitro_point_ledger_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
