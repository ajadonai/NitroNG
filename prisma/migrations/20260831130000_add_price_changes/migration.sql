-- CreateTable
CREATE TABLE "price_changes" (
    "id" TEXT NOT NULL,
    "tierId" TEXT,
    "groupName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "provider" TEXT,
    "oldSell" BIGINT NOT NULL,
    "newSell" BIGINT NOT NULL,
    "oldCost" BIGINT,
    "newCost" BIGINT,
    "usdRate" INTEGER,
    "source" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'System',
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_changes_createdAt_idx" ON "price_changes"("createdAt");
