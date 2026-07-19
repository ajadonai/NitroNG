import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  adminSessionCreate: vi.fn(),
  adminSessionDeleteMany: vi.fn(),
  adminSessionFindUnique: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  hashToken: vi.fn(),
  signAdminToken: vi.fn(() => 'signed-admin-token'),
  setAdminCookie: vi.fn(),
  clearAdminCookie: vi.fn(),
  clearGrant: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  requireAdmin: vi.fn(),
  logActivity: vi.fn(),
  logError: vi.fn(),
  rateLimit: vi.fn(),
}));

const transactionAdmin = {
  update: (...args) => mocks.adminUpdate(...args),
};
const transactionSession = {
  create: (...args) => mocks.adminSessionCreate(...args),
  deleteMany: (...args) => mocks.adminSessionDeleteMany(...args),
};
const transactionClient = {
  $queryRaw: (...args) => mocks.queryRaw(...args),
  admin: transactionAdmin,
  adminSession: transactionSession,
};

vi.mock('@/lib/prisma', () => ({
  default: {
    admin: {
      findUnique: (...args) => mocks.adminFindUnique(...args),
      update: (...args) => mocks.adminUpdate(...args),
    },
    adminSession: {
      create: (...args) => mocks.adminSessionCreate(...args),
      deleteMany: (...args) => mocks.adminSessionDeleteMany(...args),
      findUnique: (...args) => mocks.adminSessionFindUnique(...args),
    },
    $transaction: (...args) => mocks.transaction(...args),
  },
}));
vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args) => mocks.compare(...args),
    hash: (...args) => mocks.hash(...args),
  },
}));
vi.mock('@/lib/auth', () => ({
  signAdminToken: (...args) => mocks.signAdminToken(...args),
  setAdminCookie: (...args) => mocks.setAdminCookie(...args),
  clearAdminCookie: (...args) => mocks.clearAdminCookie(...args),
  hashToken: (...args) => mocks.hashToken(...args),
  detectDevice: () => ({ type: 'desktop', info: 'Test browser' }),
}));
vi.mock('@/lib/internal-dashboard-access', () => ({
  clearInternalDashboardGrantCookie: (...args) => mocks.clearGrant(...args),
}));
vi.mock('@/lib/rate-limit', () => ({
  accountRateLimitKey: vi.fn(() => 'rl:acct:admin-login:hashed-account'),
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: () => Response.json({ error: 'unavailable' }, { status: 503 }),
  tooManyRequests: () => Response.json({ error: 'limited' }, { status: 429 }),
}));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mocks.requireAdmin(...args),
  logActivity: (...args) => mocks.logActivity(...args),
  canPerformAction: () => true,
  canSeeSensitive: () => true,
  maskEmail: value => value,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set: (...args) => mocks.cookieSet(...args),
    get: (...args) => mocks.cookieGet(...args),
  })),
  headers: vi.fn(async () => new Headers({
    'x-forwarded-for': '203.0.113.20',
    'user-agent': 'Test browser',
  })),
}));
vi.mock('@/lib/logger', () => ({
  log: { error: (...args) => mocks.logError(...args), warn: vi.fn(), info: vi.fn() },
}));

const { POST: login } = await import('@/app/api/auth/admin/login/route.js');
const { POST: logout } = await import('@/app/api/auth/admin/logout/route.js');
const { POST: teamAction } = await import('@/app/api/admin/team/route.js');
const actualAuth = await vi.importActual('@/lib/auth');
const actualInternalDashboardAccess = await vi.importActual('@/lib/internal-dashboard-access');

const storedHash = '$2b$12$stored-password-hash';
const owner = {
  id: 'admin-owner',
  name: 'Owner',
  email: 'owner@example.test',
  password: storedHash,
  role: 'owner',
  status: 'Active',
};

function loginRequest(remember) {
  return new Request('https://nitro.test/api/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: owner.email, password: 'correct password', remember }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ limited: false, unavailable: false, retryAfter: 60 });
  mocks.adminFindUnique.mockResolvedValue(owner);
  mocks.compare.mockResolvedValue(true);
  mocks.queryRaw.mockResolvedValue([{ password: storedHash, status: 'Active' }]);
  mocks.adminSessionCreate.mockResolvedValue({ id: 'session-new' });
  mocks.adminUpdate.mockResolvedValue(owner);
  mocks.adminSessionDeleteMany.mockResolvedValue({ count: 2 });
  mocks.adminSessionFindUnique.mockResolvedValue(null);
  mocks.hashToken.mockImplementation(token => token === 'previous-admin-token'
    ? 'previous-token-hash'
    : 'signed-token-hash');
  mocks.cookieGet.mockReturnValue(undefined);
  mocks.signAdminToken.mockReturnValue('signed-admin-token');
  mocks.hash.mockResolvedValue('$2b$12$new-password-hash');
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.requireAdmin.mockResolvedValue({ admin: owner, error: null });
  mocks.transaction.mockImplementation(async work => {
    if (typeof work === 'function') return work(transactionClient);
    await Promise.all(work);
    return work;
  });
});

describe('admin login session boundary', () => {
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
    ['true', false],
  ])('passes a strict remember=%s decision through admin token and cookie issuance', async (
    submitted,
    expected,
  ) => {
    const response = await login(loginRequest(submitted));

    expect(response.status).toBe(200);
    expect(mocks.signAdminToken).toHaveBeenCalledWith(owner, { remember: expected });
    expect(mocks.setAdminCookie).toHaveBeenCalledWith(
      'signed-admin-token',
      owner.role,
      { remember: expected },
    );
  });

  it('locks and creates the durable session before replacing browser credentials', async () => {
    const response = await login(loginRequest());

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(2, expect.any(Request), {
      maxAttempts: 8,
      windowMs: 15 * 60 * 1000,
      key: 'rl:acct:admin-login:hashed-account',
    });
    const rawCall = mocks.queryRaw.mock.calls[0];
    expect(rawCall[0].join(' ')).toContain('FOR UPDATE');
    expect(rawCall[1]).toBe(owner.id);
    expect(mocks.adminSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: owner.id,
        tokenHash: 'signed-token-hash',
      }),
    });
    expect(mocks.adminSessionCreate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.clearGrant.mock.invocationCallOrder[0]);
    expect(mocks.clearGrant.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.setAdminCookie.mock.invocationCallOrder[0]);
  });

  it('rejects an old-password login if reset or deactivation wins the row lock', async () => {
    mocks.queryRaw.mockResolvedValue([{
      password: '$2b$12$password-changed-by-owner',
      status: 'Active',
    }]);

    const response = await login(loginRequest());

    expect(response.status).toBe(401);
    expect(mocks.adminSessionCreate).not.toHaveBeenCalled();
    expect(mocks.clearGrant).not.toHaveBeenCalled();
    expect(mocks.setAdminCookie).not.toHaveBeenCalled();
  });

  it.each([
    ['unavailable', { limited: true, unavailable: true, retryAfter: 7 }, 503],
    ['limited', { limited: true, unavailable: false, retryAfter: 411 }, 429],
  ])('stops before the admin lookup when the account budget is %s', async (
    _label,
    accountResult,
    expectedStatus,
  ) => {
    mocks.rateLimit
      .mockResolvedValueOnce({ limited: false, unavailable: false, retryAfter: 60 })
      .mockResolvedValueOnce(accountResult);

    const response = await login(loginRequest());

    expect(response.status).toBe(expectedStatus);
    expect(mocks.adminFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.setAdminCookie).not.toHaveBeenCalled();
  });

  it('atomically revokes the previous parent session before replacing browser credentials', async () => {
    mocks.cookieGet.mockImplementation(name => name === 'nitro_admin_token'
      ? { value: 'previous-admin-token' }
      : undefined);

    const response = await login(loginRequest());

    expect(response.status).toBe(200);
    expect(mocks.adminSessionDeleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'previous-token-hash' },
    });
    expect(mocks.adminSessionDeleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.adminSessionCreate.mock.invocationCallOrder[0]);
    expect(mocks.adminSessionCreate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.setAdminCookie.mock.invocationCallOrder[0]);
  });

  it('rejects replay of the previous parent JWT and its child grant after an account switch', async () => {
    const previousAdmin = {
      id: 'admin-previous',
      name: 'Previous Owner',
      email: 'previous@example.test',
      role: 'owner',
      status: 'Active',
      customPages: null,
      customActions: null,
    };
    const previousToken = actualAuth.signAdminToken(previousAdmin);
    let previousSessionActive = true;
    mocks.cookieGet.mockImplementation(name => name === 'nitro_admin_token'
      ? { value: previousToken }
      : undefined);
    mocks.hashToken.mockImplementation(token => token === previousToken
      ? 'previous-token-hash'
      : 'signed-token-hash');
    mocks.adminSessionDeleteMany.mockImplementation(async ({ where }) => {
      if (where.tokenHash === 'previous-token-hash') previousSessionActive = false;
      return { count: 1 };
    });
    mocks.adminSessionFindUnique.mockImplementation(async () => previousSessionActive
      ? {
          id: 'session-previous',
          lastActive: new Date(),
          admin: previousAdmin,
        }
      : null);

    const issuedAt = new Date('2026-07-17T10:00:00.000Z');
    const childGrant = actualInternalDashboardAccess.createInternalDashboardGrant({
      adminId: previousAdmin.id,
      sessionId: 'session-previous',
    }, {
      secret: 'phase-five-account-switch-test-secret',
      now: issuedAt,
    });

    expect((await actualAuth.getCurrentAdmin({ clearInvalidCookie: false }))?.id)
      .toBe(previousAdmin.id);
    expect(await actualInternalDashboardAccess.requireInternalDashboardAccess({
      token: childGrant,
      secret: 'phase-five-account-switch-test-secret',
      now: issuedAt,
      db: {
        adminSession: {
          findUnique: vi.fn(async () => previousSessionActive
            ? {
                id: 'session-previous',
                adminId: previousAdmin.id,
                admin: previousAdmin,
              }
            : null),
        },
      },
    })).toMatchObject({ ok: true });

    expect((await login(loginRequest())).status).toBe(200);
    await expect(actualAuth.getCurrentAdmin({ clearInvalidCookie: false })).resolves.toBeNull();
    await expect(actualInternalDashboardAccess.requireInternalDashboardAccess({
      token: childGrant,
      secret: 'phase-five-account-switch-test-secret',
      now: issuedAt,
      db: {
        adminSession: {
          findUnique: vi.fn(async () => previousSessionActive
            ? {
                id: 'session-previous',
                adminId: previousAdmin.id,
                admin: previousAdmin,
              }
            : null),
        },
      },
    })).resolves.toMatchObject({ ok: false, status: 401, reason: 'revoked' });
  });
});

describe('admin logout revocation', () => {
  beforeEach(() => {
    mocks.cookieGet.mockImplementation(name => name === 'nitro_admin_token'
      ? { value: 'previous-admin-token' }
      : undefined);
  });

  it('clears parent and child credentials only after durable revocation succeeds', async () => {
    const response = await logout();

    expect(response.status).toBe(200);
    expect(mocks.adminSessionDeleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'previous-token-hash' },
    });
    expect(mocks.adminSessionDeleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.clearGrant.mock.invocationCallOrder[0]);
    expect(mocks.clearGrant).toHaveBeenCalledOnce();
    expect(mocks.clearAdminCookie).toHaveBeenCalledOnce();
  });

  it('returns a retryable error and preserves credentials when session deletion fails', async () => {
    mocks.adminSessionDeleteMany.mockRejectedValue(new Error('database unavailable'));

    const response = await logout();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to log out. Please try again.',
    });
    expect(mocks.clearGrant).not.toHaveBeenCalled();
    expect(mocks.clearAdminCookie).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledWith(
      'ADMIN LOGOUT',
      'Durable session revocation failed',
    );
  });
});

describe('owner-driven password reset revocation', () => {
  it('updates the password and deletes every target session in one serializable transaction', async () => {
    const target = { ...owner, id: 'admin-support', role: 'support', name: 'Support' };
    mocks.adminFindUnique.mockResolvedValue(target);
    const request = new Request('https://nitro.test/api/admin/team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'resetPassword',
        adminId: target.id,
        newPassword: 'new secure password',
      }),
    });

    const response = await teamAction(request);

    expect(response.status).toBe(200);
    expect(mocks.adminUpdate).toHaveBeenCalledWith({
      where: { id: target.id },
      data: { password: '$2b$12$new-password-hash' },
    });
    expect(mocks.adminSessionDeleteMany).toHaveBeenCalledWith({
      where: { adminId: target.id },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(
      [expect.any(Promise), expect.any(Promise)],
      { isolationLevel: 'Serializable' },
    );
  });
});
