-- CreateTable
CREATE TABLE "link_clicks" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'desktop',
    "os" TEXT,
    "browser" TEXT,
    "country" TEXT,
    "city" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "link_clicks_linkId_createdAt_idx" ON "link_clicks"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "link_clicks_linkId_ipHash_idx" ON "link_clicks"("linkId", "ipHash");

-- CreateIndex
CREATE INDEX "link_clicks_createdAt_idx" ON "link_clicks"("createdAt");

-- AddForeignKey
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "acquisition_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
