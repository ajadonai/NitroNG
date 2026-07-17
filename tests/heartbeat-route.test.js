import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_NEW_PRESENCE_MAX,
  HEARTBEAT_NEW_PRESENCE_WINDOW_MS,
  HEARTBEAT_PRESENCE_COOKIE,
  createHeartbeatPresence,
  deriveHeartbeatSessionId,
  verifyHeartbeatPresence,
} from '@/lib/heartbeat-presence';

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  rateLimitUnavailable: vi.fn((message = 'Rate limiting is temporarily unavailable.', retryAfter = 5) => (
    Response.json({ error: message }, { status: 503, headers: { 'Retry-After': String(retryAfter || 5) } })
  )),
  tooManyRequests: vi.fn((message = 'Too many requests.', retryAfter = 60) => (
    Response.json({ error: message }, { status: 429, headers: { 'Retry-After': String(retryAfter || 60) } })
  )),
  cookieGet: vi.fn(),
  verifyUserToken: vi.fn(),
  verifyAdminToken: vi.fn(),
  executeRaw: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: (...args) => mocks.rateLimitUnavailable(...args),
  tooManyRequests: (...args) => mocks.tooManyRequests(...args),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: (...args) => mocks.cookieGet(...args) })),
}));
vi.mock('@/lib/auth', () => ({
  verifyUserToken: (...args) => mocks.verifyUserToken(...args),
  verifyAdminToken: (...args) => mocks.verifyAdminToken(...args),
}));
vi.mock('@/lib/prisma', () => ({
  default: { $executeRaw: (...args) => mocks.executeRaw(...args) },
}));
vi.mock('@/lib/logger', () => ({
  log: { error: (...args) => mocks.logError(...args) },
}));

const { POST } = await import('@/app/api/heartbeat/route.js');

const ROUTE_SECRET = 'heartbeat-route-test-secret';
const originalHeartbeatSecret = process.env.HEARTBEAT_SECRET;
const originalJwtSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const cookieValues = new Map();
const pass = {
  limited: false,
  unavailable: false,
  remaining: 119,
  retryAfter: 60,
};

const validBody = JSON.stringify({
  sid: 'attacker-controlled-legacy-id',
  page: '/dashboard/orders',
});

function request({ body = validBody, headers = {}, url = 'https://nitro.test/api/heartbeat' } = {}) {
  const requestHeaders = new Headers({
    'content-type': 'application/json',
    origin: 'https://nitro.test',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Test Browser',
    'x-forwarded-for': '203.0.113.10',
  });
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) requestHeaders.delete(name);
    else requestHeaders.set(name, value);
  }
  return {
    url,
    headers: requestHeaders,
    text: vi.fn().mockResolvedValue(body),
  };
}

function presenceToken() {
  return createHeartbeatPresence({ secret: ROUTE_SECRET }).token;
}

function persistedValues(call = 0) {
  return mocks.executeRaw.mock.calls[call].slice(1);
}

function responsePresenceToken(response) {
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(new RegExp(`${HEARTBEAT_PRESENCE_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieValues.clear();
  process.env.HEARTBEAT_SECRET = ROUTE_SECRET;
  process.env.NODE_ENV = 'test';
  mocks.rateLimit.mockResolvedValue(pass);
  mocks.cookieGet.mockImplementation(name => (
    cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined
  ));
  mocks.verifyUserToken.mockReturnValue(null);
  mocks.verifyAdminToken.mockReturnValue(null);
  mocks.executeRaw.mockResolvedValue(1);
});

afterAll(() => {
  if (originalHeartbeatSecret === undefined) delete process.env.HEARTBEAT_SECRET;
  else process.env.HEARTBEAT_SECRET = originalHeartbeatSecret;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('heartbeat route protection and parsing order', () => {
  it('returns 503 before reading the body when distributed protection is unavailable', async () => {
    mocks.rateLimit.mockResolvedValue({ limited: true, unavailable: true, retryAfter: 5 });
    const req = request();

    const response = await POST(req);

    expect(response.status).toBe(503);
    expect(req.text).not.toHaveBeenCalled();
    expect(mocks.cookieGet).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.rateLimitUnavailable).toHaveBeenCalledWith(
      'Heartbeat protection is temporarily unavailable.',
      5,
    );
  });

  it('fails closed if the main limiter throws before body parsing', async () => {
    mocks.rateLimit.mockRejectedValue(new Error('redis unavailable'));
    const req = request();

    const response = await POST(req);

    expect(response.status).toBe(503);
    expect(req.text).not.toHaveBeenCalled();
    expect(mocks.cookieGet).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('returns 429 before reading the body after the request budget is exhausted', async () => {
    mocks.rateLimit.mockResolvedValue({ limited: true, unavailable: false, retryAfter: 9 });
    const req = request();

    const response = await POST(req);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('9');
    expect(req.text).not.toHaveBeenCalled();
    expect(mocks.cookieGet).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing JSON content type', { 'content-type': null }, 415],
    ['a non-JSON content type', { 'content-type': 'text/plain' }, 415],
    ['a foreign Origin', { origin: 'https://evil.test' }, 403],
    ['a cross-site fetch signal', { 'sec-fetch-site': 'cross-site', origin: null }, 403],
  ])('rejects %s before reading or authenticating', async (_label, headers, status) => {
    const req = request({ headers });

    const response = await POST(req);

    expect(response.status).toBe(status);
    expect(req.text).not.toHaveBeenCalled();
    expect(mocks.cookieGet).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
  });

  it('rejects a declared oversized body without reading it', async () => {
    const req = request({ headers: { 'content-length': '1025' } });
    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(req.text).not.toHaveBeenCalled();
    expect(mocks.cookieGet).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('rejects malformed, oversized, and unsafe pages without touching identity or storage', async () => {
    for (const [body, expectedStatus] of [
      ['{', 400],
      [JSON.stringify({ page: '/orders?open=1' }), 400],
      [JSON.stringify({ page: `/${'x'.repeat(1100)}` }), 413],
      [JSON.stringify({ page: 42 }), 400],
    ]) {
      const response = await POST(request({ body }));
      expect(response.status).toBe(expectedStatus);
    }
    expect(mocks.cookieGet).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });
});

describe('server-issued presence admission', () => {
  it('mints a signed HttpOnly presence cookie and derives the anonymous database key', async () => {
    const response = await POST(request());
    const data = await response.json();
    const token = responsePresenceToken(response);
    const verified = verifyHeartbeatPresence(token, { secret: ROUTE_SECRET });
    const [sid, userId, page, userAgent] = persistedValues();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, written: true });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=strict');
    expect(response.headers.get('set-cookie')).toContain('Path=/api/heartbeat');
    expect(verified.ok).toBe(true);
    expect(sid).toBe(deriveHeartbeatSessionId(verified.presenceId, 'anonymous', {
      secret: ROUTE_SECRET,
    }));
    expect(sid).not.toBe('attacker-controlled-legacy-id');
    expect(userId).toBeNull();
    expect(page).toBe('/dashboard/orders');
    expect(userAgent).toBe('Test Browser');
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.rateLimit.mock.calls[1][1]).toMatchObject({
      maxAttempts: HEARTBEAT_NEW_PRESENCE_MAX,
      windowMs: HEARTBEAT_NEW_PRESENCE_WINDOW_MS,
    });
    expect(mocks.rateLimit.mock.calls[1][1].key)
      .toMatch(/^rl:heartbeat:new-presence:[a-f0-9]{32}$/);
  });

  it('reuses a valid presence without spending the new-presence budget or rotating the cookie', async () => {
    const token = presenceToken();
    cookieValues.set(HEARTBEAT_PRESENCE_COOKIE, token);
    const presence = verifyHeartbeatPresence(token, { secret: ROUTE_SECRET });

    const response = await POST(request({ body: JSON.stringify({ page: '/' }) }));
    const [sid] = persistedValues();

    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(sid).toBe(deriveHeartbeatSessionId(presence.presenceId, 'anonymous', {
      secret: ROUTE_SECRET,
    }));
  });

  it('treats a tampered presence as new and rotates it only after admission succeeds', async () => {
    cookieValues.set(HEARTBEAT_PRESENCE_COOKIE, `${presenceToken()}tampered`);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
    const replacement = responsePresenceToken(response);
    expect(verifyHeartbeatPresence(replacement, { secret: ROUTE_SECRET }).ok).toBe(true);
  });

  it('returns 429 without writing or minting when new-presence admission is exhausted', async () => {
    mocks.rateLimit
      .mockResolvedValueOnce(pass)
      .mockResolvedValueOnce({ limited: true, unavailable: false, retryAfter: 37 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('37');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.tooManyRequests).toHaveBeenCalledWith('Too many new heartbeat sessions.', 37);
  });

  it.each(['unavailable', 'throws'])('fails closed when new-presence admission %s', async mode => {
    if (mode === 'throws') {
      mocks.rateLimit.mockResolvedValueOnce(pass).mockRejectedValueOnce(new Error('redis unavailable'));
    } else {
      mocks.rateLimit.mockResolvedValueOnce(pass).mockResolvedValueOnce({
        limited: true,
        unavailable: true,
        retryAfter: 11,
      });
    }

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('fails closed when production presence signing is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEARTBEAT_SECRET;
    delete process.env.JWT_SECRET;

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.rateLimitUnavailable).toHaveBeenCalledWith(
      'Heartbeat identity is temporarily unavailable.',
    );
  });
});

describe('identity-scoped persistence', () => {
  it('derives different keys for anonymous, user, and admin views of the same presence', async () => {
    const token = presenceToken();
    cookieValues.set(HEARTBEAT_PRESENCE_COOKIE, token);

    await POST(request());

    cookieValues.set('nitro_token', 'signed-user-token');
    mocks.verifyUserToken.mockReturnValue({ id: 'user-1', type: 'user' });
    await POST(request());

    cookieValues.delete('nitro_token');
    cookieValues.set('nitro_admin_token', 'signed-admin-token');
    mocks.verifyUserToken.mockReturnValue(null);
    mocks.verifyAdminToken.mockReturnValue({ id: 'admin-1', type: 'admin' });
    await POST(request());

    const [anonymousSid, anonymousUser] = persistedValues(0);
    const [userSid, userId] = persistedValues(1);
    const [adminSid, adminId] = persistedValues(2);
    expect(new Set([anonymousSid, userSid, adminSid])).toHaveLength(3);
    expect(anonymousUser).toBeNull();
    expect(userId).toBe('user-1');
    expect(adminId).toBe('admin-1');
    expect(mocks.verifyUserToken).toHaveBeenCalledWith('signed-user-token');
    expect(mocks.verifyAdminToken).toHaveBeenCalledWith('signed-admin-token');
    expect(mocks.rateLimit).toHaveBeenCalledTimes(3);
  });

  it('prefers a verified user identity when both auth cookies are present', async () => {
    cookieValues.set(HEARTBEAT_PRESENCE_COOKIE, presenceToken());
    cookieValues.set('nitro_token', 'signed-user-token');
    cookieValues.set('nitro_admin_token', 'signed-admin-token');
    mocks.verifyUserToken.mockReturnValue({ id: 'user-1', type: 'user' });

    await POST(request());

    expect(persistedValues()[1]).toBe('user-1');
    expect(mocks.verifyAdminToken).not.toHaveBeenCalled();
  });

  it('returns 500 and logs persistence failures without exposing details', async () => {
    cookieValues.set(HEARTBEAT_PRESENCE_COOKIE, presenceToken());
    mocks.executeRaw.mockRejectedValue(new Error('database unavailable'));

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(mocks.logError).toHaveBeenCalledWith('Heartbeat', 'database unavailable');
  });
});
