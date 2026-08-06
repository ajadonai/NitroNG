-- Durable, idempotent Meta Conversions API delivery queue.
CREATE TABLE "meta_capi_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "testEventCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_capi_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_capi_events_eventId_key" ON "meta_capi_events"("eventId");
CREATE INDEX "meta_capi_events_status_nextAttemptAt_idx" ON "meta_capi_events"("status", "nextAttemptAt");
CREATE INDEX "meta_capi_events_eventName_createdAt_idx" ON "meta_capi_events"("eventName", "createdAt");
