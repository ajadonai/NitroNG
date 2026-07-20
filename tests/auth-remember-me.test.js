import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  jwtSign: vi.fn(() => 'signed-token'),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: (...args) => mocks.cookieSet(...args) })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args) => mocks.jwtSign(...args),
    verify: vi.fn(),
  },
}));

const {
  ADMIN_SESSION_SECONDS,
  DEFAULT_USER_SESSION_SECONDS,
  REMEMBERED_USER_SESSION_SECONDS,
  USER_SESSION_SECONDS,
  getAdminSessionSeconds,
  getUserSessionSeconds,
  setAdminCookie,
  setUserCookie,
  signAdminToken,
  signUserToken,
} = await import('@/lib/auth');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.jwtSign.mockReturnValue('signed-token');
});

describe('Remember me session lifetimes', () => {
  it('uses one day for a browser-session login and preserves the seven-day persistent lifetime when remembered', () => {
    expect(getUserSessionSeconds(false)).toBe(USER_SESSION_SECONDS);
    expect(getUserSessionSeconds(true)).toBe(REMEMBERED_USER_SESSION_SECONDS);
    expect(getUserSessionSeconds()).toBe(DEFAULT_USER_SESSION_SECONDS);

    signUserToken({ id: 'user-1', email: 'user@example.test' }, { remember: false });
    expect(mocks.jwtSign).toHaveBeenLastCalledWith(
      { id: 'user-1', email: 'user@example.test', type: 'user' },
      expect.any(String),
      { expiresIn: USER_SESSION_SECONDS },
    );

    signUserToken({ id: 'user-1', email: 'user@example.test' }, { remember: true });
    expect(mocks.jwtSign).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'user-1', type: 'user' }),
      expect.any(String),
      { expiresIn: REMEMBERED_USER_SESSION_SECONDS },
    );
  });

  it('creates a session cookie when unchecked and a persistent cookie when checked', async () => {
    await setUserCookie('session-token', { remember: false });
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_token',
      'session-token',
      expect.not.objectContaining({ maxAge: expect.anything() }),
    );

    await setUserCookie('remembered-token', { remember: true });
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_token',
      'remembered-token',
      expect.objectContaining({ maxAge: REMEMBERED_USER_SESSION_SECONDS }),
    );

    await setUserCookie('default-token');
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_token',
      'default-token',
      expect.objectContaining({ maxAge: DEFAULT_USER_SESSION_SECONDS }),
    );
  });

  it('uses an eight-hour browser session for admins and preserves role-based remembered lifetimes', async () => {
    const admin = { id: 'admin-1', email: 'admin@example.test', role: 'superadmin' };
    expect(getAdminSessionSeconds(admin.role, false)).toBe(ADMIN_SESSION_SECONDS);
    expect(getAdminSessionSeconds('admin', true)).toBe(7 * 24 * 60 * 60);
    expect(getAdminSessionSeconds('superadmin', true)).toBe(14 * 24 * 60 * 60);

    signAdminToken(admin, { remember: false });
    expect(mocks.jwtSign).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: admin.id, type: 'admin' }),
      expect.any(String),
      { expiresIn: ADMIN_SESSION_SECONDS },
    );

    await setAdminCookie('admin-session-token', admin.role, { remember: false });
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_admin_token',
      'admin-session-token',
      expect.not.objectContaining({ maxAge: expect.anything() }),
    );

    await setAdminCookie('admin-remembered-token', admin.role, { remember: true });
    expect(mocks.cookieSet).toHaveBeenLastCalledWith(
      'nitro_admin_token',
      'admin-remembered-token',
      expect.objectContaining({ maxAge: 14 * 24 * 60 * 60 }),
    );
  });
});
