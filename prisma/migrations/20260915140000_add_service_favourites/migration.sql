-- A service somebody kept, so they can find it again in a list of 934.
-- Unlike a vote it is not earned by ordering: keeping something is private and
-- costs nobody anything, so anyone may keep anything.
CREATE TABLE "service_favourites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_favourites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_favourites_userId_serviceId_key" ON "service_favourites"("userId", "serviceId");
CREATE INDEX "service_favourites_userId_idx" ON "service_favourites"("userId");

ALTER TABLE "service_favourites" ADD CONSTRAINT "service_favourites_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_favourites" ADD CONSTRAINT "service_favourites_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
