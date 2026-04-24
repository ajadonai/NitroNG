-- AlterTable
ALTER TABLE "orders" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "orders_userId_batchId_idx" ON "orders"("userId", "batchId");
