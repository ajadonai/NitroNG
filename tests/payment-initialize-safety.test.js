import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  userFindUnique: vi.fn(),
  settingFindUnique: vi.fn(),
}));

vi.mock('@/lib/fetch', () => ({ fetchWithRetry: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    setting: { findUnique: mocks.settingFindUnique },
    transaction: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  tooManyRequests: vi.fn(() => Response.json({ error: 'limited' }, { status: 429 })),
}));
vi.mock('@/lib/meta-capi', () => ({ parseFbCookies: vi.fn(() => ({})) }));

const { POST } = await import('@/app/api/payments/initialize/route');

function request(idempotencyKey) {
  return {
    headers: new Headers(),
    json: async () => ({ amount: 5_000, method: 'flutterwave', idempotencyKey }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ limited: false });
  mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  mocks.userFindUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.test', name: 'User' });
});

describe('payment initialization idempotency namespace', () => {
  it('rejects keys reserved for durable financial effects before gateway work', async () => {
    const response = await POST(request('payment:coupon:coupon-1'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid idempotency key' });
    expect(mocks.settingFindUnique).not.toHaveBeenCalled();
  });

  it('rejects unbounded idempotency keys before gateway work', async () => {
    const response = await POST(request('x'.repeat(201)));

    expect(response.status).toBe(400);
    expect(mocks.settingFindUnique).not.toHaveBeenCalled();
  });
});
