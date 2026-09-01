-- CreateTable
CREATE TABLE "referral_earnings" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'held',
    "releasesAt" TIMESTAMP(3) NOT NULL,
    "payoutId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_payouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankAccountName" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_earnings_referredId_key" ON "referral_earnings"("referredId");

-- CreateIndex
CREATE INDEX "referral_earnings_referrerId_status_idx" ON "referral_earnings"("referrerId", "status");

-- CreateIndex
CREATE INDEX "referral_payouts_userId_idx" ON "referral_payouts"("userId");

-- CreateIndex
CREATE INDEX "referral_payouts_status_idx" ON "referral_payouts"("status");
