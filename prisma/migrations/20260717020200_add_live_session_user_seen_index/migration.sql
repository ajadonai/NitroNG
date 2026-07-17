-- Build separately and concurrently so live heartbeat writes remain available.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "live_sessions_lastSeen_idx"
    ON "live_sessions"("lastSeen");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "live_sessions_userId_lastSeen_idx"
    ON "live_sessions"("userId", "lastSeen");
