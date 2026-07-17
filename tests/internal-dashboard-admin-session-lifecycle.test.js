import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  adminSessionCreate: vi.fn(),
  adminSessionDeleteMany: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  setAdminCookie: vi.fn(),
  clearGrant: vi.fn(),
  requireAdmin: vi.fn(),
  logActivity: vi.fn(),
  rateLimit: vi.fn(),
}));

const transactionAdmin = {
  update: (...args) => mocks.adminUpdate(...args),
};
const transactionSession = {
  create: (...args) => mocks.adminSessionCreate(...args),
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
  signAdminToken: () => 'signed-admin-token',
  setAdminCookie: (...args) => mocks.setAdminCookie(...args),
  hashToken: () => 'signed-token-hash',
  detectDevice: () => ({ type: 'desktop', info: 'Test browser' }),
}));
vi.mock('@/lib/internal-dashboard-access', () => ({
  clearInternalDashboardGrantCookie: (...args) => mocks.clearGrant(...args),
}));
vi.mock('@/lib/rate-limit', () => ({
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
  cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn() })),
  headers: vi.fn(async () => new Headers({
    'x-forwarded-for': '203.0.113.20',
    'user-agent': 'Test browser',
  })),
}));
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { POST: login } = await import('@/app/api/auth/admin/login/route.js');
const { POST: teamAction } = await import('@/app/api/admin/team/route.js');

const storedHash = '$2b$12$stored-password-hash';
const owner = {
  id: 'admin-owner',
  name: 'Owner',
  email: 'owner@example.test',
  password: storedHash,
  role: 'owner',
  status: 'Active',
};

function loginRequest() {
  return new Request('https://nitro.test/api/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: owner.email, password: 'correct password' }),
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
  it('locks and creates the durable session before replacing browser credentials', async () => {
    const response = await login(loginRequest());

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
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
