import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  jwtVerify: vi.fn(),
  jwtSign: vi.fn(() => 'renewed-token'),
  sessionFindUnique: vi.fn(),
  sessionUpdateMany: vi.fn(),
  adminSessionFindUnique: vi.fn(),
  adminSessionUpdateMany: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (...args) => mocks.cookieGet(...args),
    set: (...args) => mocks.cookieSet(...args),
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: (...args) => mocks.jwtVerify(...args),
    sign: (...args) => mocks.jwtSign(...args),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    session: {
      findUnique: (...args) => mocks.sessionFindUnique(...args),
      updateMany: (...args) => mocks.sessionUpdateMany(...args),
    },
    adminSession: {
      findUnique: (...args) => mocks.adminSessionFindUnique(...args),
      updateMany: (...args) => mocks.adminSessionUpdateMany(...args),
    },
  },
}));

const {
  ADMIN_ABSOLUTE_LIFETIME_SECONDS,
  REMEMBERED_USER_SESSION_SECONDS,
  USER_ABSOLUTE_LIFETIME_SECONDS,
  USER_SESSION_SECONDS,
  getCurrentAdmin,
  getCurrentUser,
  renewAdminSession,
  renewUserSession,
} = await import('@/lib/auth');

const NOW_SECONDS = 2_000_000_000;
const NOW_MS = NOW_SECONDS * 1000;
const DAY = 24 * 60 * 60;

function tokenWindow(duration, elapsed) {
  const iat = NOW_SECONDS - elapsed;
  return { iat, exp: iat + duration };
}

function userPayload(overrides = {}) {
  return {
    id: 'user-1',
    email: 'user@example.test',
    type: 'user',
    sid: 'session-user-1',
    remember: true,
    ...tokenWindow(REMEMBERED_USER_SESSION_SECONDS, 6 * DAY),
    ...overrides,
  };
}

function userSession(overrides = {}) {
  return {
    id: 'session-user-1',
    userId: 'user-1',
    remember: true,
    lastActive: new Date(NOW_MS),
    createdAt: new Date(NOW_MS - 10 * DAY * 1000),
    user: {
      id: 'user-1',
      email: 'user@example.test',
      status: 'Active',
    },
    ...overrides,
  };
}

function adminPayload(overrides = {}) {
  return {
    id: 'admin-1',
    email: 'admin@example.test',
    role: 'admin',
    type: 'admin',
    sid: 'session-admin-1',
    remember: true,
    ...tokenWindow(7 * DAY, 6 * DAY),
    ...overrides,
  };
}

function adminSession(overrides = {}) {
  return {
    id: 'session-admin-1',
    adminId: 'admin-1',
    remember: true,
    lastActive: new Date(NOW_MS),
    createdAt: new Date(NOW_MS - DAY * 1000),
    admin: {
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'admin',
      status: 'Active',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  mocks.cookieGet.mockImplementation(name => ({
    value: name === 'nitro_admin_token' ? 'admin-token' : 'user-token',
  }));
  mocks.jwtSign.mockReturnValue('renewed-token');
  mocks.sessionFindUnique.mockResolvedValue(userSession());
  mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.adminSessionFindUnique.mockResolvedValue(adminSession());
  mocks.adminSessionUpdateMany.mockResolvedValue({ count: 1 });
});

describe('customer session renewal', () => {
  it('keeps an exact-hash legacy session alive without silently changing its cookie class', async () => {
    mocks.jwtVerify.mockReturnValue({
      id: 'user-1',
      email: 'user@example.test',
      type: 'user',
      ...tokenWindow(7 * DAY, 2 * DAY),
    });
    mocks.sessionFindUnique.mockResolvedValue({
      userId: 'user-1',
      user: { status: 'Active' },
    });

    await expect(renewUserSession()).resolves.toEqual({
      renewed: false,
      legacy: true,
    });
    expect(mocks.sessionFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
    expect(mocks.jwtSign).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('clears a valid-looking legacy cookie whose durable session was revoked', async () => {
    mocks.jwtVerify.mockReturnValue({
      id: 'user-1',
      type: 'user',
      ...tokenWindow(7 * DAY, 2 * DAY),
    });
    mocks.sessionFindUnique.mockResolvedValue(null);

    await expect(renewUserSession()).resolves.toBeNull();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'nitro_token',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('does not renew before the final quarter of the signed token lifetime', async () => {
    mocks.jwtVerify.mockReturnValue(userPayload({
      ...tokenWindow(REMEMBERED_USER_SESSION_SECONDS, 5 * DAY),
    }));

    const result = await renewUserSession();

    expect(result.renewed).toBe(false);
    expect(mocks.jwtSign).not.toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    [REMEMBERED_USER_SESSION_SECONDS * 0.75 - 1, false],
    [REMEMBERED_USER_SESSION_SECONDS * 0.75, true],
    [REMEMBERED_USER_SESSION_SECONDS * 0.75 + 1, true],
  ])('applies the final-quarter boundary at elapsed=%s seconds', async (
    elapsed,
    expectedRenewal,
  ) => {
    mocks.jwtVerify.mockReturnValue(userPayload({
      ...tokenWindow(REMEMBERED_USER_SESSION_SECONDS, elapsed),
    }));

    const result = await renewUserSession();

    expect(result.renewed).toBe(expectedRenewal);
    expect(mocks.jwtSign).toHaveBeenCalledTimes(expectedRenewal ? 1 : 0);
  });

  it('renews in the final quarter and preserves a remembered persistent cookie', async () => {
    mocks.jwtVerify.mockReturnValue(userPayload());

    const result = await renewUserSession();

    expect(result).toEqual({
      renewed: true,
      expiresIn: REMEMBERED_USER_SESSION_SECONDS,
    });
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'session-user-1', userId: 'user-1' },
      data: { lastActive: expect.any(Date) },
    });
    expect(mocks.jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        sid: 'session-user-1',
        remember: true,
      }),
      expect.any(String),
      { expiresIn: REMEMBERED_USER_SESSION_SECONDS },
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'nitro_token',
      'renewed-token',
      expect.objectContaining({ maxAge: REMEMBERED_USER_SESSION_SECONDS }),
    );
  });

  it('keeps an unremembered renewal as a browser-session cookie', async () => {
    mocks.jwtVerify.mockReturnValue(userPayload({
      remember: false,
      ...tokenWindow(USER_SESSION_SECONDS, 20 * 60 * 60),
    }));
    mocks.sessionFindUnique.mockResolvedValue(userSession({ remember: false }));

    const result = await renewUserSession();

    expect(result).toEqual({ renewed: true, expiresIn: USER_SESSION_SECONDS });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'nitro_token',
      'renewed-token',
      expect.not.objectContaining({ maxAge: expect.anything() }),
    );
  });

  it('caps the renewed cookie and JWT at the immutable 30-day deadline', async () => {
    mocks.jwtVerify.mockReturnValue(userPayload({
      ...tokenWindow(REMEMBERED_USER_SESSION_SECONDS, 6.5 * DAY),
    }));
    mocks.sessionFindUnique.mockResolvedValue(userSession({
      createdAt: new Date(NOW_MS - 29 * DAY * 1000),
    }));

    const result = await renewUserSession();

    expect(result).toEqual({ renewed: true, expiresIn: DAY });
    expect(mocks.jwtSign).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.any(String),
      { expiresIn: DAY },
    );
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_token',
      'renewed-token',
      expect.objectContaining({ maxAge: DAY }),
    );
  });

  it('fails closed when revocation wins the final durable-session fence', async () => {
    mocks.jwtVerify.mockReturnValue(userPayload());
    mocks.sessionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(renewUserSession()).resolves.toBeNull();
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_token',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});

describe('admin session renewal', () => {
  it('uses the current database role immediately when claims changed', async () => {
    mocks.jwtVerify.mockReturnValue(adminPayload({
      role: 'superadmin',
      ...tokenWindow(14 * DAY, DAY),
    }));
    mocks.adminSessionFindUnique.mockResolvedValue(adminSession({
      admin: {
        id: 'admin-1',
        email: 'admin@example.test',
        role: 'admin',
        status: 'Active',
      },
    }));

    const result = await renewAdminSession();

    expect(result).toEqual({ renewed: true, expiresIn: 7 * DAY });
    expect(mocks.jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', sid: 'session-admin-1' }),
      expect.any(String),
      { expiresIn: 7 * DAY },
    );
  });

  it('rejects and clears a session at the 14-day absolute deadline', async () => {
    mocks.jwtVerify.mockReturnValue(adminPayload());
    mocks.adminSessionFindUnique.mockResolvedValue(adminSession({
      createdAt: new Date(
        NOW_MS - ADMIN_ABSOLUTE_LIFETIME_SECONDS * 1000,
      ),
    }));

    await expect(renewAdminSession()).resolves.toBeNull();
    expect(mocks.adminSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'nitro_admin_token',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('does not allow a customer absolute lifetime constant to drift below 30 days', () => {
    expect(USER_ABSOLUTE_LIFETIME_SECONDS).toBe(30 * DAY);
  });
});

describe('absolute lifetime on ordinary authentication', () => {
  it('rejects a sid-backed customer session at its 30-day deadline', async () => {
    mocks.jwtVerify.mockReturnValue(userPayload());
    mocks.sessionFindUnique.mockResolvedValue(userSession({
      createdAt: new Date(NOW_MS - USER_ABSOLUTE_LIFETIME_SECONDS * 1000),
    }));

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'nitro_token',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('rejects a sid-backed admin session at its 14-day deadline', async () => {
    mocks.jwtVerify.mockReturnValue(adminPayload());
    mocks.adminSessionFindUnique.mockResolvedValue(adminSession({
      createdAt: new Date(NOW_MS - ADMIN_ABSOLUTE_LIFETIME_SECONDS * 1000),
    }));

    await expect(getCurrentAdmin()).resolves.toBeNull();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'nitro_admin_token',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});
