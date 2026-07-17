import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import {
  canAccessInternalDashboard,
  createInternalDashboardGrant,
  deriveInternalDashboardSigningKey,
  INTERNAL_DASHBOARD_COOKIE,
  INTERNAL_DASHBOARD_GRANT_TTL_SECONDS,
  internalDashboardCookieOptions,
  InternalDashboardAccessUnavailableError,
  requireInternalDashboardAccess,
  resolveInternalDashboardRootSecret,
  verifyInternalDashboardGrant,
} from '@/lib/internal-dashboard-access';
import {
  isInternalDashboardPath,
  safeInternalDashboardDestination,
} from '@/lib/internal-dashboard-path';

const SECRET = 'test-internal-dashboard-secret-with-enough-entropy';
const ISSUED_AT = new Date('2026-07-17T10:00:00.000Z');

function admin(overrides = {}) {
  return {
    id: 'admin-1',
    name: 'Owner',
    email: 'owner@example.test',
    role: 'owner',
    status: 'Active',
    customPages: null,
    customActions: null,
    ...overrides,
  };
}

function dbSession(overrides = {}) {
  const row = {
    id: 'session-1',
    adminId: 'admin-1',
    admin: admin(),
    ...overrides,
  };
  return {
    row,
    db: { adminSession: { findUnique: vi.fn().mockResolvedValue(row) } },
  };
}

function grant(overrides = {}) {
  return createInternalDashboardGrant(
    { adminId: 'admin-1', sessionId: 'session-1', ...overrides },
    { secret: SECRET, now: ISSUED_AT },
  );
}

describe('internal dashboard grant properties', () => {
  it('round-trips bounded admin and session identifiers', () => {
    const identifier = fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/);
    fc.assert(fc.property(identifier, identifier, (adminId, sessionId) => {
      const token = createInternalDashboardGrant(
        { adminId, sessionId },
        { secret: SECRET, now: ISSUED_AT },
      );
      const result = verifyInternalDashboardGrant(token, {
        secret: SECRET,
        now: new Date(ISSUED_AT.getTime() + 1_000),
      });
      expect(result).toMatchObject({ ok: true, adminId, sessionId });
    }), { numRuns: 100 });
  });

  it('rejects every single-character mutation of the signed payload segment', () => {
    const token = grant();
    const payloadEnd = token.indexOf('.');
    fc.assert(fc.property(
      fc.integer({ min: 0, max: payloadEnd - 1 }),
      index => {
        const replacement = token[index] === 'A' ? 'B' : 'A';
        const tampered = token.slice(0, index) + replacement + token.slice(index + 1);
        expect(verifyInternalDashboardGrant(tampered, {
          secret: SECRET,
          now: ISSUED_AT,
        }).ok).toBe(false);
      },
    ));
  });

  it('expires at the absolute 15-minute boundary', () => {
    const token = grant();
    const before = new Date(ISSUED_AT.getTime() + INTERNAL_DASHBOARD_GRANT_TTL_SECONDS * 1000 - 1);
    const expired = new Date(ISSUED_AT.getTime() + INTERNAL_DASHBOARD_GRANT_TTL_SECONDS * 1000);
    expect(verifyInternalDashboardGrant(token, { secret: SECRET, now: before }).ok).toBe(true);
    expect(verifyInternalDashboardGrant(token, { secret: SECRET, now: expired })).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects a correctly signed token with the wrong scope', () => {
    const valid = grant();
    const payload = { ...jwt.decode(valid), scope: 'some-other-scope' };
    const wrongScope = jwt.sign(payload, deriveInternalDashboardSigningKey(SECRET), {
      algorithm: 'HS256',
    });
    expect(verifyInternalDashboardGrant(wrongScope, {
      secret: SECRET,
      now: ISSUED_AT,
    }).ok).toBe(false);
  });

  it('fails closed in production when no signing secret exists', () => {
    const env = { NODE_ENV: 'production' };
    expect(resolveInternalDashboardRootSecret(env)).toBeNull();
    expect(verifyInternalDashboardGrant('anything', { env })).toMatchObject({
      ok: false,
      unavailable: true,
    });
    expect(() => createInternalDashboardGrant(
      { adminId: 'admin-1', sessionId: 'session-1' },
      { env, now: ISSUED_AT },
    )).toThrow(InternalDashboardAccessUnavailableError);
  });
});

describe('internal dashboard session binding and authorization', () => {
  it('accepts an active owner tied to the signed current session', async () => {
    const { db } = dbSession();
    const result = await requireInternalDashboardAccess({
      token: grant(), db, secret: SECRET, now: ISSUED_AT,
    });
    expect(result).toMatchObject({ ok: true, status: 200, sessionId: 'session-1' });
    expect(db.adminSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session-1' },
    }));
  });

  it('rejects a grant after its parent admin session is revoked', async () => {
    const db = { adminSession: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(requireInternalDashboardAccess({
      token: grant(), db, secret: SECRET, now: ISSUED_AT,
    })).resolves.toMatchObject({ ok: false, status: 401, reason: 'revoked' });
  });

  it('rejects wrong-session and wrong-admin bindings', async () => {
    const wrongSessionDb = { adminSession: { findUnique: vi.fn().mockResolvedValue(null) } };
    expect(await requireInternalDashboardAccess({
      token: grant({ sessionId: 'session-other' }),
      db: wrongSessionDb,
      secret: SECRET,
      now: ISSUED_AT,
    })).toMatchObject({ ok: false, status: 401 });

    const { db } = dbSession({ adminId: 'admin-other', admin: admin({ id: 'admin-other' }) });
    expect(await requireInternalDashboardAccess({
      token: grant(), db, secret: SECRET, now: ISSUED_AT,
    })).toMatchObject({ ok: false, status: 401 });
  });

  it('allows only active owner or superadmin roles', () => {
    expect(canAccessInternalDashboard(admin({ role: 'owner' }))).toBe(true);
    expect(canAccessInternalDashboard(admin({ role: 'superadmin' }))).toBe(true);
    expect(canAccessInternalDashboard(admin({ role: 'admin' }))).toBe(false);
    expect(canAccessInternalDashboard(admin({ role: 'support', customActions: '["internalDashboards.view"]' }))).toBe(false);
    expect(canAccessInternalDashboard(admin({ status: 'Inactive' }))).toBe(false);
  });
});

describe('internal dashboard browser boundary', () => {
  it('uses a 15-minute HttpOnly Strict cookie with production Secure', () => {
    expect(INTERNAL_DASHBOARD_COOKIE).not.toMatch(/key|secret/i);
    expect(internalDashboardCookieOptions({ NODE_ENV: 'production' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 900,
    });
  });

  it('recognizes internal dashboard paths and only permits exact safe redirects', () => {
    expect(isInternalDashboardPath('/pulse')).toBe(true);
    expect(isInternalDashboardPath('/pulse/detail')).toBe(true);
    expect(isInternalDashboardPath('/live')).toBe(true);
    expect(isInternalDashboardPath('/liveness')).toBe(false);
    expect(safeInternalDashboardDestination('/live', '/admin')).toBe('/live');
    expect(safeInternalDashboardDestination('https://evil.example', '/admin')).toBe('/admin');
    expect(safeInternalDashboardDestination('//evil.example', '/admin')).toBe('/admin');
    expect(safeInternalDashboardDestination('/pulse?key=legacy', '/admin')).toBe('/admin');
  });
});
