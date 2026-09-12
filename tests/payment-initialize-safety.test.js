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
    user: { findUnique: mocks.userFindUnique, update: vi.fn() },
    setting: { findUnique: mocks.settingFindUnique },
    transaction: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/fx-deposit', () => ({ resolveDepositRate: vi.fn(async () => ({ depositRate: 1529, usdRates: { GHS: 12.5 }, source: 'test' })) }));
vi.mock('@/lib/env', () => ({ getApplicationUrl: () => 'https://nitro.test' }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  rateLimitUnavailable: vi.fn(() => Response.json({ error: 'unavailable' }, { status: 503 })),
  tooManyRequests: vi.fn(() => Response.json({ error: 'limited' }, { status: 429 })),
}));
vi.mock('@/lib/meta-capi', () => ({
  loadStoredCapiIdentity: vi.fn(async () => ({})),
  persistFbTouch: vi.fn(async () => {}), parseFbCookies: vi.fn(() => ({})) }));

const { POST } = await import('@/app/api/payments/initialize/route');

function request(idempotencyKey, extra = {}) {
  return {
    headers: new Headers(),
    json: async () => ({ amount: 5_000, method: 'flutterwave', idempotencyKey, ...extra }),
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

describe('charge currency follows the customer country', () => {
  async function initialise(user, extra) {
    const { fetchWithRetry } = await import('@/lib/fetch');
    const prisma = (await import('@/lib/prisma')).default;
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.test', name: 'User', ...user });
    mocks.settingFindUnique.mockResolvedValue({ value: JSON.stringify({ fields: { secretKey: 'FLWSECK_TEST' } }) });
    fetchWithRetry.mockResolvedValue({ json: async () => ({ status: 'success', data: { link: 'https://checkout.test' } }) });
    const response = await POST(request('key-' + Math.random(), extra));
    expect(response.status).toBe(200);
    const body = JSON.parse(fetchWithRetry.mock.calls.at(-1)[1].body);
    const row = prisma.transaction.create.mock.calls.at(-1)[0].data;
    return { body, row };
  }

  it('charges a Ghanaian in cedis at the padded rate and stores the quote, crediting naira', async () => {
    const { body, row } = await initialise({ country: 'GH' });
    expect(body.currency).toBe('GHS');
    expect(body.amount).toBe(40.88); // ₦5,000 at 1529/12.5 per cedi, ceiled to the cent
    expect(row.amount).toBe(500_000); // the naira credit is untouched
    expect(row.providerPriceCurrency).toBe('GHS');
    expect(row.providerPriceAmount).toBe(40.88);
  });

  it('charges a Nigerian in naira exactly as before, with no quote stored', async () => {
    const { body, row } = await initialise({ country: 'NG' });
    expect(body.currency).toBe('NGN');
    expect(body.amount).toBe(5_000);
    expect(row.providerPriceCurrency).toBeUndefined();
  });

  it('falls back to naira when the rate for the country is missing', async () => {
    const { body } = await initialise({ country: 'KE' }); // no KES cross-rate in the mock
    expect(body.currency).toBe('NGN');
    expect(body.amount).toBe(5_000);
  });

  it('charges a Nigerian reading prices in dollars in dollars, by card, at the padded rate', async () => {
    const { body, row } = await initialise({ country: 'NG' }, { currency: 'USD' });
    expect(body.currency).toBe('USD');
    expect(body.amount).toBe(3.28);              // ₦5,000 / 1529, ceilinged to the cent
    expect(body.payment_options).toBe('card');
    expect(row.providerPriceCurrency).toBe('USD');
    expect(row.providerPriceAmount).toBe(3.28);
    expect(row.amount).toBe(500_000);            // the credit stays ₦5,000
  });

  it('the picker overrides only with a foreign currency it can charge in — naira or nonsense falls back to the country', async () => {
    expect((await initialise({ country: 'GH' }, { currency: 'NGN' })).body.currency).toBe('GHS');
    expect((await initialise({ country: 'NG' }, { currency: 'EUR' })).body.currency).toBe('NGN');
  });
});
