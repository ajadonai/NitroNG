import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  sessionDeleteMany: vi.fn(),
  clearUserCookie: vi.fn(),
  verifyUserToken: vi.fn(),
  hashToken: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (...args) => mocks.cookieGet(...args),
  })),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    session: {
      deleteMany: (...args) => mocks.sessionDeleteMany(...args),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  clearUserCookie: (...args) => mocks.clearUserCookie(...args),
  verifyUserToken: (...args) => mocks.verifyUserToken(...args),
  hashToken: (...args) => mocks.hashToken(...args),
}));

vi.mock('@/lib/logger', () => ({
  log: {
    error: (...args) => mocks.logError(...args),
  },
}));

const { POST: logout } = await import('@/app/api/auth/logout/route.js');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieGet.mockReturnValue({ value: 'signed-user-token' });
  mocks.verifyUserToken.mockReturnValue({
    id: 'user-1',
    sid: 'session-current',
    type: 'user',
  });
  mocks.hashToken.mockReturnValue('legacy-token-hash');
  mocks.sessionDeleteMany.mockResolvedValue({ count: 1 });
  mocks.clearUserCookie.mockResolvedValue(undefined);
});

describe('customer logout durable revocation', () => {
  it('revokes a sid-backed session before clearing the browser cookie', async () => {
    const response = await logout();

    expect(response.status).toBe(200);
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: { id: 'session-current' },
    });
    expect(mocks.sessionDeleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.clearUserCookie.mock.invocationCallOrder[0]);
  });

  it('retains exact-hash revocation for legacy tokens without a sid', async () => {
    mocks.verifyUserToken.mockReturnValue({
      id: 'user-1',
      type: 'user',
    });

    const response = await logout();

    expect(response.status).toBe(200);
    expect(mocks.hashToken).toHaveBeenCalledWith('signed-user-token');
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'legacy-token-hash' },
    });
    expect(mocks.clearUserCookie).toHaveBeenCalledOnce();
  });

  it('returns a retryable error and preserves the cookie when revocation fails', async () => {
    mocks.sessionDeleteMany.mockRejectedValue(new Error('database unavailable'));

    const response = await logout();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to log out. Please try again.',
    });
    expect(mocks.clearUserCookie).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledWith(
      'USER LOGOUT',
      'Durable session revocation failed',
    );
  });
});
