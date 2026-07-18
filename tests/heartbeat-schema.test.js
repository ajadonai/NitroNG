import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

describe('heartbeat schema and scheduled cleanup wiring', () => {
  it('indexes stale-signup activity lookups by user and last-seen time', () => {
    const schema = read('prisma/schema.prisma');
    const model = schema.match(/model LiveSession \{[\s\S]*?\n\}/)?.[0] || '';
    expect(model).toContain('@@index([lastSeen])');
    expect(model).toContain('@@index([userId, lastSeen], map: "live_sessions_userId_lastSeen_idx")');
  });

  it('keeps the fresh migration chain deployable despite the missing historical table migration', () => {
    const migration = read('prisma/migrations/20260717020100_ensure_live_sessions/migration.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "live_sessions"');
    expect(migration).toContain('CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("sessionId")');
    expect(migration).not.toContain('DROP TABLE');
    expect(migration).not.toContain('CREATE INDEX');
  });

  it('builds both heartbeat indexes concurrently for an existing live table', () => {
    const migration = read('prisma/migrations/20260717020200_add_live_session_user_seen_index/migration.sql');
    expect(migration).toContain(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "live_sessions_lastSeen_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "live_sessions_userId_lastSeen_idx"',
    );
  });

  it('runs heartbeat cleanup independently every fifteen minutes', () => {
    const config = JSON.parse(read('vercel.json'));
    expect(config.crons).toContainEqual({
      path: '/api/cron/heartbeat',
      schedule: '*/15 * * * *',
    });
  });
});
