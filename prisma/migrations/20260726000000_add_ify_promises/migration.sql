CREATE TABLE "ify_promises" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "orderNumber" TEXT,
    "promiseText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "owner" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "lastUpdateAt" TIMESTAMP(3),
    "lastUpdateText" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    CONSTRAINT "ify_promises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ify_promise_updates" (
    "id" TEXT NOT NULL,
    "promiseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT NOT NULL,
    "messageSent" TEXT,
    "note" TEXT,
    CONSTRAINT "ify_promise_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ify_promises_state_dueAt_idx" ON "ify_promises"("state", "dueAt");
CREATE INDEX "ify_promises_customerNumber_idx" ON "ify_promises"("customerNumber");
CREATE INDEX "ify_promise_updates_promiseId_idx" ON "ify_promise_updates"("promiseId");

ALTER TABLE "ify_promise_updates"
    ADD CONSTRAINT "ify_promise_updates_promiseId_fkey"
    FOREIGN KEY ("promiseId") REFERENCES "ify_promises"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
