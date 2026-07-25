import { describe, expect, it } from 'vitest';
import { assertSafeE2EDatabase } from '../e2e/fixtures/database.js';

describe('browser fixture safety guard', () => {
  it('requires the explicit browser-test flag', () => {
    expect(() => assertSafeE2EDatabase({
      DATABASE_URL: 'postgresql://nitro:test@127.0.0.1:5432/nitro_ci',
    })).toThrow(/NITRO_E2E=1/);
  });

  it('rejects a remote database even when the flag is present', () => {
    expect(() => assertSafeE2EDatabase({
      NITRO_E2E: '1',
      DATABASE_URL: 'postgresql://nitro:test@db.example.com:5432/nitro_ci',
    })).toThrow(/localhost/);
  });

  it('rejects a production-named local database', () => {
    expect(() => assertSafeE2EDatabase({
      NITRO_E2E: '1',
      DATABASE_URL: 'postgresql://nitro:test@127.0.0.1:5432/nitro',
    })).toThrow(/_ci or _test/);
  });

  it('accepts matching loopback CI database URLs', () => {
    expect(assertSafeE2EDatabase({
      NITRO_E2E: '1',
      DATABASE_URL: 'postgresql://nitro:test@127.0.0.1:5432/nitro_ci',
      DIRECT_URL: 'postgresql://nitro:test@localhost:5432/nitro_ci',
    })).toEqual({ database: 'nitro_ci', hostname: '127.0.0.1' });
  });

  it('rejects a direct connection aimed at another database', () => {
    expect(() => assertSafeE2EDatabase({
      NITRO_E2E: '1',
      DATABASE_URL: 'postgresql://nitro:test@127.0.0.1:5432/nitro_ci',
      DIRECT_URL: 'postgresql://nitro:test@127.0.0.1:5432/other_test',
    })).toThrow(/same browser-test database/);
  });
});
