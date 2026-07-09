import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdminSession = { findUnique: vi.fn(), update: vi.fn() };
const mockAdmin = { findUnique: vi.fn() };
const mockPrisma = { adminSession: mockAdminSession, admin: mockAdmin };

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const mockCookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue(mockCookieStore) }));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn().mockReturnValue({ id: 'adm1', email: 'a@test.com', role: 'admin', type: 'admin' }),
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
    expect(payload._admin).not.toHaveProperty('password');
    expect(payload._admin.name).toBe('Admin');
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
});
