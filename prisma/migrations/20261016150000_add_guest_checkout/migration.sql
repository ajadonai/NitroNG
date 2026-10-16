-- Guest checkout (docs/v2/guest_checkout_brief.md). Additive: two new tables,
-- nothing existing changes.

-- CreateTable
CREATE TABLE "guest_checkouts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Quoted',
    "ownerUserId" TEXT NOT NULL,
    "email" TEXT,
    "tierId" TEXT,
    "serviceId" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "comments" TEXT,
    "priceKobo" INTEGER NOT NULL,
    "creditAppliedKobo" INTEGER NOT NULL DEFAULT 0,
    "creditFromCode" TEXT,
    "dueKobo" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "transactionId" TEXT,
    "orderId" TEXT,
    "creditKobo" INTEGER NOT NULL DEFAULT 0,
    "failReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "placedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_credit_events" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_credit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_checkouts_code_key" ON "guest_checkouts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "guest_checkouts_transactionId_key" ON "guest_checkouts"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_checkouts_orderId_key" ON "guest_checkouts"("orderId");

-- CreateIndex
CREATE INDEX "guest_checkouts_email_idx" ON "guest_checkouts"("email");

-- CreateIndex
CREATE INDEX "guest_checkouts_status_expiresAt_idx" ON "guest_checkouts"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "guest_checkouts_ownerUserId_idx" ON "guest_checkouts"("ownerUserId");

-- CreateIndex
CREATE INDEX "guest_credit_events_checkoutId_idx" ON "guest_credit_events"("checkoutId");

-- AddForeignKey
ALTER TABLE "guest_checkouts" ADD CONSTRAINT "guest_checkouts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_checkouts" ADD CONSTRAINT "guest_checkouts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_checkouts" ADD CONSTRAINT "guest_checkouts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_credit_events" ADD CONSTRAINT "guest_credit_events_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "guest_checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
