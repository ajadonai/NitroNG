-- Full-list votes. One row per customer per service, changeable; value is
-- 1 (thumb up) or -1 (thumb down) so the aggregate is a SUM.
CREATE TABLE "service_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_votes_userId_serviceId_key" ON "service_votes"("userId", "serviceId");
CREATE INDEX "service_votes_serviceId_idx" ON "service_votes"("serviceId");

ALTER TABLE "service_votes" ADD CONSTRAINT "service_votes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_votes" ADD CONSTRAINT "service_votes_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only 1 or -1 are meaningful; anything else would poison the aggregate.
ALTER TABLE "service_votes" ADD CONSTRAINT "service_votes_value_check" CHECK ("value" IN (1, -1));
