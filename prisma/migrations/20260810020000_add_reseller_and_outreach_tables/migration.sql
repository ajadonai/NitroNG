-- CreateTable
CREATE TABLE "reseller_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "catalog" TEXT NOT NULL DEFAULT 'curated',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reseller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "touchType" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedBy" TEXT,

    CONSTRAINT "outreach_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_service_map" (
    "apiId" SERIAL NOT NULL,
    "tierId" TEXT,
    "serviceId" TEXT,

    CONSTRAINT "reseller_service_map_pkey" PRIMARY KEY ("apiId")
);

-- CreateIndex
CREATE UNIQUE INDEX "reseller_profiles_userId_key" ON "reseller_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_profiles_apiKey_key" ON "reseller_profiles"("apiKey");

-- CreateIndex
CREATE INDEX "outreach_contacts_userId_idx" ON "outreach_contacts"("userId");

-- CreateIndex
CREATE INDEX "outreach_contacts_contactedAt_idx" ON "outreach_contacts"("contactedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_service_map_tierId_key" ON "reseller_service_map"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_service_map_serviceId_key" ON "reseller_service_map"("serviceId");

-- AddForeignKey
ALTER TABLE "reseller_profiles" ADD CONSTRAINT "reseller_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "outreach_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_service_map" ADD CONSTRAINT "reseller_service_map_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "service_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_service_map" ADD CONSTRAINT "reseller_service_map_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
