import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import {
  canAccessInternalDashboard,
  createInternalDashboardGrant,
  deriveInternalDashboardSigningKey,
  getInternalDashboardGrantTtl,
  INTERNAL_DASHBOARD_COOKIE,
  INTERNAL_DASHBOARD_GRANT_TTL_SECONDS,
  internalDashboardCookieOptions,
  InternalDashboardAccessUnavailableError,
  renewInternalDashboardGrant,
  requireInternalDashboardAccess,
  resolveInternalDashboardRootSecret,
  verifyInternalDashboardGrant,
} from '@/lib/internal-dashboard-access';
import {
  isInternalDashboardPath,
  safeInternalDashboardDestination,
} from '@/lib/internal-dashboard-path';
import { ADMIN_ABSOLUTE_LIFETIME_SECONDS } from '@/lib/auth';

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
    remember: true,
    createdAt: ISSUED_AT,
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

  it('accepts a shorter grant while rejecting zero or oversized lifetimes', () => {
    const shortToken = createInternalDashboardGrant(
      { adminId: 'admin-1', sessionId: 'session-1' },
      { secret: SECRET, now: ISSUED_AT, ttlSeconds: 120 },
    );
    const verified = verifyInternalDashboardGrant(shortToken, {
      secret: SECRET,
      now: new Date(ISSUED_AT.getTime() + 1_000),
    });

    expect(verified.ok).toBe(true);
    expect(verified.expiresAt.getTime() - ISSUED_AT.getTime()).toBe(120_000);
    expect(() => createInternalDashboardGrant(
      { adminId: 'admin-1', sessionId: 'session-1' },
      { secret: SECRET, now: ISSUED_AT, ttlSeconds: 0 },
    )).toThrow(RangeError);
    expect(() => createInternalDashboardGrant(
      { adminId: 'admin-1', sessionId: 'session-1' },
      {
        secret: SECRET,
        now: ISSUED_AT,
        ttlSeconds: INTERNAL_DASHBOARD_GRANT_TTL_SECONDS + 1,
      },
    )).toThrow(RangeError);
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

  it('rejects a child grant at the parent session absolute boundary', async () => {
    const parentExpiry = new Date(
      ISSUED_AT.getTime() + ADMIN_ABSOLUTE_LIFETIME_SECONDS * 1000,
    );
    const childToken = createInternalDashboardGrant(
      { adminId: 'admin-1', sessionId: 'session-1' },
      {
        secret: SECRET,
        now: new Date(parentExpiry.getTime() - 60_000),
        ttlSeconds: 120,
      },
    );
    const { db } = dbSession();

    await expect(requireInternalDashboardAccess({
      token: childToken,
      db,
      secret: SECRET,
      now: parentExpiry,
    })).resolves.toMatchObject({
      ok: false,
      status: 401,
      reason: 'expired',
    });
  });

  it('reports the exact remaining parent lifetime before the boundary', async () => {
    const parentExpiry = new Date(
      ISSUED_AT.getTime() + ADMIN_ABSOLUTE_LIFETIME_SECONDS * 1000,
    );
    const now = new Date(parentExpiry.getTime() - 120_000);
    const childToken = createInternalDashboardGrant(
      { adminId: 'admin-1', sessionId: 'session-1' },
      { secret: SECRET, now, ttlSeconds: 120 },
    );
    const { db } = dbSession();

    await expect(requireInternalDashboardAccess({
      token: childToken,
      db,
      secret: SECRET,
      now,
    })).resolves.toMatchObject({
      ok: true,
      parentExpiresAt: parentExpiry,
      parentRemainingSeconds: 120,
    });
  });
});

describe('internal dashboard browser boundary', () => {
  it('uses an 8-hour HttpOnly Strict cookie with production Secure', () => {
    expect(INTERNAL_DASHBOARD_COOKIE).not.toMatch(/key|secret/i);
    expect(internalDashboardCookieOptions({ env: { NODE_ENV: 'production' } })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 28800,
    });
  });

  it('caps remembered child cookies and renewed grants to the parent lifetime', () => {
    const now = new Date('2026-07-30T10:00:00.000Z');
    const parentExpiresAt = new Date(now.getTime() + 120_000);
    expect(getInternalDashboardGrantTtl(parentExpiresAt, now)).toBe(120);
    expect(internalDashboardCookieOptions({
      remember: true,
      ttlSeconds: 120,
      env: { NODE_ENV: 'production' },
    })).toMatchObject({ maxAge: 120, secure: true });

    const response = Response.json({ ok: true });
    renewInternalDashboardGrant({
      ok: true,
      admin: admin(),
      sessionId: 'session-1',
      remember: true,
      expiresAt: new Date(now.getTime() + 60_000),
      parentExpiresAt,
    }, response, {
      now,
      secret: SECRET,
      env: { NODE_ENV: 'production' },
    });

    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('Max-Age=120');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    const token = cookie.match(
      new RegExp(`${INTERNAL_DASHBOARD_COOKIE}=([^;]+)`),
    )?.[1];
    expect(verifyInternalDashboardGrant(token, {
      secret: SECRET,
      now: new Date(now.getTime() + 1_000),
    }).expiresAt).toEqual(parentExpiresAt);
  });

  it('keeps unremembered child renewal as a browser-session cookie', () => {
    const now = new Date('2026-07-30T10:00:00.000Z');
    const response = Response.json({ ok: true });
    renewInternalDashboardGrant({
      ok: true,
      admin: admin(),
      sessionId: 'session-1',
      remember: false,
      expiresAt: new Date(now.getTime() + 60_000),
      parentExpiresAt: new Date(now.getTime() + 120_000),
    }, response, { now, secret: SECRET });

    expect(response.headers.get('set-cookie')).not.toContain('Max-Age');
    expect(internalDashboardCookieOptions({
      remember: false,
      ttlSeconds: 120,
    })).not.toHaveProperty('maxAge');
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
