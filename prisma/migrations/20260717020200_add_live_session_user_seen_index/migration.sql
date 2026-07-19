CREATE INDEX IF NOT EXISTS "live_sessions_lastSeen_idx"
    ON "live_sessions"("lastSeen");

CREATE INDEX IF NOT EXISTS "live_sessions_userId_lastSeen_idx"
    ON "live_sessions"("userId", "lastSeen");
