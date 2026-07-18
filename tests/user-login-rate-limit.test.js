import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountRateLimitKey: vi.fn(() => 'rl:acct:user-login:hashed-account'),
  rateLimit: vi.fn(),
  userFindUnique: vi.fn(),
  compare: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  accountRateLimitKey: (...args) => mocks.accountRateLimitKey(...args),
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: (_message, retryAfter) => Response.json(
    { error: 'unavailable' },
    { status: 503, headers: { 'Retry-After': String(retryAfter) } },
  ),
  tooManyRequests: (message, retryAfter) => Response.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  ),
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: (...args) => mocks.userFindUnique(...args) },
    session: {
      create: vi.fn(),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('bcryptjs', () => ({
  default: { compare: (...args) => mocks.compare(...args) },
}));
vi.mock('@/lib/auth', () => ({
  signUserToken: () => 'signed-user-token',
  setUserCookie: vi.fn(),
  detectDevice: () => ({ type: 'web', info: 'Test browser' }),
  hashToken: () => 'signed-token-hash',
}));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock('@/lib/logger', () => ({
  log: { error: (...args) => mocks.logError(...args) },
}));

const { POST: login } = await import('@/app/api/auth/login/route.js');

function loginRequest(email = ' Person@Example.Test ') {
  return new Request('https://nitro.test/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({ email, password: 'correct password' }),
  });
}

function allowed(retryAfter = 60) {
  return { limited: false, unavailable: false, retryAfter };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accountRateLimitKey.mockReturnValue('rl:acct:user-login:hashed-account');
  mocks.rateLimit.mockResolvedValue(allowed());
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.compare.mockResolvedValue(false);
});

describe('user login rate limits', () => {
  it('retains the IP budget and adds a hashed account budget after normalization', async () => {
    const response = await login(loginRequest());

    expect(response.status).toBe(401);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.rateLimit.mock.calls[0][1]).toEqual({
      maxAttempts: 10,
      windowMs: 60_000,
    });
    expect(mocks.accountRateLimitKey).toHaveBeenCalledWith(
      'person@example.test',
      'user-login',
    );
    expect(mocks.rateLimit.mock.calls[1][1]).toEqual({
      maxAttempts: 8,
      windowMs: 15 * 60_000,
      key: 'rl:acct:user-login:hashed-account',
    });
    expect(mocks.rateLimit.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.accountRateLimitKey.mock.invocationCallOrder[0]);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: 'person@example.test' },
    });
  });

  it('fails closed on account-budget infrastructure failure before database access', async () => {
    mocks.rateLimit
      .mockResolvedValueOnce(allowed())
      .mockResolvedValueOnce({ limited: true, unavailable: true, retryAfter: 7 });

    const response = await login(loginRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('7');
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('blocks an exhausted account budget before database access', async () => {
    mocks.rateLimit
      .mockResolvedValueOnce(allowed())
      .mockResolvedValueOnce({ limited: true, unavailable: false, retryAfter: 413 });

    const response = await login(loginRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('413');
    await expect(response.json()).resolves.toEqual({
      error: 'Too many login attempts for this account. Try again in 15 minutes.',
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('does not create an account key until both normalized credentials are present', async () => {
    const response = await login(new Request('https://nitro.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.test', password: '' }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.accountRateLimitKey).not.toHaveBeenCalled();
  });

  it.each([
    [new Date('2999-01-01T00:00:00.000Z'), 'Contact support@nitro.ng before the deletion deadline to cancel.'],
    [new Date('2000-01-01T00:00:00.000Z'), 'deletion deadline has passed and it cannot be restored.'],
  ])('does not advertise restoration beyond the deletion deadline', async (deletedAt, expected) => {
    mocks.userFindUnique.mockResolvedValue({ status: 'PendingDeletion', deletedAt });

    const response = await login(loginRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain(expected);
    expect(mocks.compare).not.toHaveBeenCalled();
  });
});
