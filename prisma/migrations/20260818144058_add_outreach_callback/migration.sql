-- AlterTable
ALTER TABLE "outreach_contacts" ADD COLUMN     "callbackAt" TIMESTAMP(3),
ADD COLUMN     "callbackAttempts" INTEGER NOT NULL DEFAULT 0;
-- CreateIndex
CREATE INDEX "outreach_contacts_callbackAt_idx" ON "outreach_contacts"("callbackAt");
