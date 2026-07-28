CREATE TABLE "ify_messages" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "inbound" TEXT NOT NULL,
    "reply" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ify_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ify_messages_phone_idx" ON "ify_messages"("phone");
CREATE INDEX "ify_messages_action_idx" ON "ify_messages"("action");
CREATE INDEX "ify_messages_createdAt_idx" ON "ify_messages"("createdAt");
