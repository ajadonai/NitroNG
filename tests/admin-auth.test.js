import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJwtVerify = vi.hoisted(() => vi.fn());
const mockAdminSession = { findUnique: vi.fn(), update: vi.fn() };
const mockAdmin = { findUnique: vi.fn() };
const mockSession = { findUnique: vi.fn(), update: vi.fn() };
const mockUser = { findUnique: vi.fn() };
const mockPrisma = { adminSession: mockAdminSession, admin: mockAdmin, session: mockSession, user: mockUser };

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const mockCookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue(mockCookieStore) }));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: mockJwtVerify,
  },
}));

const ADMIN_ROW = {
  id: 'adm1', name: 'Admin', email: 'a@test.com', role: 'admin', status: 'Active',
  password: '$2b$10$hashedpassword',
  customPages: null, customActions: null, themePreference: 'auto',
  lastActive: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockJwtVerify.mockReturnValue({ id: 'adm1', email: 'a@test.com', role: 'admin', type: 'admin' });
});

describe('getCurrentAdmin — no password leak', () => {
  it('_admin never contains the password field', async () => {
    mockAdminSession.findUnique.mockResolvedValue({
      id: 'sess1',
      lastActive: new Date(Date.now() - 10 * 60 * 1000),
      admin: {
        id: ADMIN_ROW.id, name: ADMIN_ROW.name, email: ADMIN_ROW.email,
        role: ADMIN_ROW.role, status: ADMIN_ROW.status,
        customPages: null, customActions: null, themePreference: 'auto',
        lastActive: ADMIN_ROW.lastActive,
      },
    });
    mockAdminSession.update.mockResolvedValue({});

    const { getCurrentAdmin } = await import('@/lib/auth');
    const payload = await getCurrentAdmin();

    expect(payload._admin).toBeDefined();
    expect(payload._sessionId).toBe('sess1');
    expect(payload._admin).not.toHaveProperty('password');
    expect(payload._admin.name).toBe('Admin');
  });

  it('can verify from a Server Component without trying to mutate an invalid cookie', async () => {
    mockJwtVerify.mockImplementation(() => { throw new Error('expired'); });

    const { getCurrentAdmin } = await import('@/lib/auth');
    const payload = await getCurrentAdmin({ clearInvalidCookie: false });

    expect(payload).toBeNull();
    expect(mockCookieStore.set).not.toHaveBeenCalled();
    expect(mockAdminSession.findUnique).not.toHaveBeenCalled();
  });
});

describe('getCurrentUser — one auth read with throttled activity writes', () => {
  it('loads session and user status together without a second user query', async () => {
    mockJwtVerify.mockReturnValue({ id: 'user1', email: 'u@test.com', type: 'user' });
    mockSession.findUnique.mockResolvedValue({
      id: 'sess-user-1',
      lastActive: new Date(),
      user: { status: 'Active' },
    });

    const { getCurrentUser } = await import('@/lib/auth');
    const payload = await getCurrentUser();

    expect(payload.id).toBe('user1');
    expect(mockSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ user: { select: { status: true } } }),
    }));
    expect(mockUser.findUnique).not.toHaveBeenCalled();
    expect(mockSession.update).not.toHaveBeenCalled();
  });

  it('refreshes lastActive only when it is older than five minutes', async () => {
    mockJwtVerify.mockReturnValue({ id: 'user1', email: 'u@test.com', type: 'user' });
    mockSession.findUnique.mockResolvedValue({
      id: 'sess-user-1',
      lastActive: new Date(Date.now() - 6 * 60 * 1000),
      user: { status: 'Active' },
    });
    mockSession.update.mockResolvedValue({});

    const { getCurrentUser } = await import('@/lib/auth');
    await getCurrentUser();

    expect(mockSession.update).toHaveBeenCalledTimes(1);
  });
});

describe('requireAdmin — no password leak', () => {
  it('returned admin object never contains the password field', async () => {
    mockAdminSession.findUnique.mockResolvedValue({
      id: 'sess1',
      lastActive: new Date(),
      admin: {
        id: ADMIN_ROW.id, name: ADMIN_ROW.name, email: ADMIN_ROW.email,
        role: ADMIN_ROW.role, status: ADMIN_ROW.status,
        customPages: null, customActions: null, themePreference: 'auto',
        lastActive: ADMIN_ROW.lastActive,
      },
    });

    const { requireAdmin } = await import('@/lib/admin');
    const { admin, error } = await requireAdmin('overview');

    expect(error).toBeNull();
    expect(admin).not.toHaveProperty('password');
    expect(admin.name).toBe('Admin');
  });

  it('returns 503 when the database is unreachable', async () => {
    mockAdminSession.findUnique.mockRejectedValue(new Error("Can't reach database server"));

    const { requireAdmin } = await import('@/lib/admin');
    const { admin, error } = await requireAdmin('overview');

    expect(admin).toBeNull();
    expect(error).toBeInstanceOf(Response);
    expect(error.status).toBe(503);
    const body = await error.json();
    expect(body.error).toBe('Service temporarily unavailable');
  });
});
