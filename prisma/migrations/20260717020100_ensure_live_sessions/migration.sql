-- The LiveSession model predates the checked-in migration history. Keep fresh
-- installs deployable while leaving an existing production table untouched.
CREATE TABLE IF NOT EXISTS "live_sessions" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "page" TEXT NOT NULL,
    "ua" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("sessionId")
);
