import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

describe('session persistence rollout', () => {
  it('stores the remember choice on both durable session models', () => {
    const schema = read('prisma/schema.prisma');
    const userSession = schema.match(/model Session \{[\s\S]*?\n\}/)?.[0] || '';
    const adminSession = schema.match(/model AdminSession \{[\s\S]*?\n\}/)?.[0] || '';

    expect(userSession).toContain('remember   Boolean  @default(false)');
    expect(adminSession).toContain('remember   Boolean  @default(false)');
  });

  it('adds non-null remember columns safely to both mapped production tables', () => {
    const migration = read(
      'prisma/migrations/20260730120000_add_session_remember/migration.sql',
    );

    expect(migration).toContain(
      'ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "remember" BOOLEAN NOT NULL DEFAULT false;',
    );
    expect(migration).toContain(
      'ALTER TABLE "admin_sessions" ADD COLUMN IF NOT EXISTS "remember" BOOLEAN NOT NULL DEFAULT false;',
    );
    expect(migration).not.toMatch(/\b(?:DROP|DELETE|TRUNCATE)\b/i);
  });
});
