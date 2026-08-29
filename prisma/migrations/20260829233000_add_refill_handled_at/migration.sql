-- AlterTable: an admin sending a refill marks the request handled; a new customer request clears it.
ALTER TABLE "orders" ADD COLUMN "refillHandledAt" TIMESTAMP(3);
