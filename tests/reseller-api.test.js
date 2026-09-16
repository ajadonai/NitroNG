import { beforeEach, describe, expect, it, vi } from 'vitest';

// The reseller API is a second door to the same shop. These tests pin the
// contract third-party panels parse: form-encoded in, JSON out, errors as
// { error } on 200, only a bad key on 401, and orders through the shared path.

const mockPrisma = {
  resellerProfile: { findUnique: vi.fn() },
  resellerServiceMap: { findUnique: vi.fn(), findMany: vi.fn() },
  service: { findMany: vi.fn() },
  setting: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  order: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue({ limited: false }), rateLimitUnavailable: vi.fn(), tooManyRequests: vi.fn() }));
vi.mock('@/lib/reseller', () => ({
  getResellerTerms: vi.fn(),
  getMarkupSettings: vi.fn().mockResolvedValue({}),
  wholesaleOf: vi.fn((retail) => Math.round(retail * 0.8)),
}));
vi.mock('@/lib/full-catalogue', () => ({ platformOf: vi.fn(() => 'instagram') }));
vi.mock('@/lib/reseller-format', () => ({
  formatResellerService: vi.fn((name) => ({ label: name, attrs: [], grade: null })),
  dedupeCategoryLabels: vi.fn((rows) => rows),
}));
const createOrderForSession = vi.fn();
const patchOrderForSession = vi.fn();
const refillOrderForSession = vi.fn();
vi.mock('@/app/api/orders/route', () => ({ createOrderForSession, patchOrderForSession }));
vi.mock('@/app/api/orders/refill/route', () => ({ refillOrderForSession }));
vi.mock('@/lib/reseller-ids', () => ({ FULL_CATALOGUE_WHERE: { provider: { in: ['mtp', 'dao'] }, providerListedAt: { not: null }, costPer1k: { gt: 0 }, tiers: { none: {} } }, mintMissingResellerIds: vi.fn() }));

const { POST } = await import('@/app/api/v2/route');
const { getResellerTerms } = await import('@/lib/reseller');

const user = { id: 'u1', email: 'r@x.ng', phone: '234', name: 'Reseller', balance: 12345600 };
function form(params) {
  return new Request('https://nitro.ng/api/v2', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
}
async function call(params) {
  const res = await POST(form(params));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockImplementation(({ where }) => Promise.resolve(where?.apiKey ? { ...user, emailVerified: true } : { balance: user.balance }));
  getResellerTerms.mockResolvedValue({ discountPct: null });
  mockPrisma.resellerServiceMap.findMany.mockResolvedValue([]);
  mockPrisma.service.findMany.mockResolvedValue([
    { name: 'TikTok Views [Fast]', category: 'TikTok', platform: 'tiktok', sellPer1k: 52000n, costPer1k: 0.2, min: 500, max: 1000000, refill: false, cancel: false, resellerMap: { apiId: 4102, retiredAt: null } },
  ]);
  mockPrisma.setting.findUnique.mockResolvedValue({ value: '1600' });
  mockPrisma.order.findFirst.mockResolvedValue(null);
});

describe('POST /api/v2 — auth', () => {
  it('rejects a missing or unknown key with 401', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const r = await call({ key: 'nope-nope-nope', action: 'balance' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'Invalid API key' });
  });
  it('rejects an unverified account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...user, emailVerified: false });
    const r = await call({ key: 'k'.repeat(16), action: 'balance' });
    expect(r.status).toBe(401);
  });
  it('answers an unknown action as an error on 200', async () => {
    const r = await call({ key: 'k'.repeat(16), action: 'teleport' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ error: 'Incorrect action' });
  });
});

describe('balance and services', () => {
  it('returns the balance as a two-place NGN string', async () => {
    const r = await call({ key: 'k'.repeat(16), action: 'balance' });
    expect(r.body).toEqual({ balance: '123456.00', currency: 'NGN' });
  });
  it('serves the full list, and only the full list, to every key', async () => {
    // One catalogue on purpose. Two accounts calling the same endpoint used to
    // get different service lists off a per-account flag, so the same ID could
    // be valid for one and unknown to the other — no contract a panel can
    // integrate against.
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    expect(r.status).toBe(200);
    expect(r.body.map(s => s.service)).toEqual([4102]);
    expect(r.body[0]).toMatchObject({ name: 'TikTok Views [Fast]', rate: '416.00' });
  });

  it('gives an account with no reseller terms the same list, at retail', async () => {
    getResellerTerms.mockResolvedValue(null);
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    expect(r.body.map(s => s.service)).toEqual([4102]);
  });

  it('never returns a curated tier', async () => {
    mockPrisma.resellerServiceMap.findMany.mockResolvedValue([{ apiId: 3877, tierId: 'tier-std' }]);
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    expect(r.body.map(s => s.service)).not.toContain(3877);
  });

  it('drops a retired ID from the listing', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      { name: 'TikTok Views [Fast]', category: 'TikTok', platform: 'tiktok', sellPer1k: 52000n, costPer1k: 0.2, min: 500, max: 1000000, refill: false, cancel: false, resellerMap: { apiId: 4102, retiredAt: null } },
      { name: 'Retired thing', category: 'TikTok', platform: 'tiktok', sellPer1k: 52000n, costPer1k: 0.2, min: 1, max: 1, refill: false, cancel: false, resellerMap: { apiId: 4103, retiredAt: new Date() } },
    ]);
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    expect(r.body.map(s => s.service)).toEqual([4102]);
  });

  it('sends the Nitro tile as the category, never the provider\'s own', async () => {
    // A category is the one field a panel prints straight into its own
    // storefront, and the provider's carries the house style this API exists
    // to hide: 169 services under a blue circle, 281 under "Vip", others under
    // "Cheapest", "Private" and a bold-unicode "Premium".
    mockPrisma.service.findMany.mockResolvedValue([
      { name: 'Instagram Followers', category: '\u{1F535}', platform: 'instagram', sellPer1k: 52000n, costPer1k: 0.2, min: 1, max: 100000, refill: false, cancel: false, resellerMap: { apiId: 4200, retiredAt: null } },
    ]);
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    expect(r.body[0].category).toBe('instagram');
  });
});

describe('add', () => {
  it('places an order through the shared web path with source api', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: null, service: { id: 's9', enabled: true, provider: 'dao', providerListedAt: new Date(), costPer1k: 2 } });
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-4211', status: 'Processing' } }));
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '4102', link: 'https://instagram.com/x', quantity: '1000' });
    expect(r.body).toEqual({ order: 'NTR-4211' });
    const [session, body, , opts] = createOrderForSession.mock.calls[0];
    expect(session.id).toBe('u1');
    expect(body).toMatchObject({ serviceId: 's9', link: 'https://instagram.com/x', quantity: 1000, confirmDuplicate: true });
    expect(opts).toMatchObject({ source: 'api', catalogue: true });
  });
  it('a retry inside sixty seconds answers with the order already placed', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: null, service: { id: 's9', enabled: true, provider: 'dao', providerListedAt: new Date(), costPer1k: 2 } });
    mockPrisma.order.findFirst.mockResolvedValue({ orderId: 'NTR-4211' });
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '4102', link: 'https://instagram.com/x', quantity: '1000' });
    expect(r.body).toEqual({ order: 'NTR-4211' });
    expect(createOrderForSession).not.toHaveBeenCalled();
    expect(mockPrisma.order.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u1', source: 'api', link: 'https://instagram.com/x', quantity: 1000, serviceId: 's9' });
  });
  it('can order a listed service the retail menu has switched off', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: null, service: { id: 's9', enabled: false, provider: 'dao', providerListedAt: new Date(), costPer1k: 2 } });
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-77', status: 'Processing' } }));
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '4102', link: 'https://x.com/a', quantity: '1000' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ order: 'NTR-77' });
    const [, body, , opts] = createOrderForSession.mock.calls[0];
    expect(body.serviceId).toBe('s9');
    expect(opts).toMatchObject({ source: 'api', catalogue: true });
  });
  it('refuses a curated tier ID, the same way the listing omits it', async () => {
    // An ID the catalogue never returns but the order endpoint quietly accepts
    // is a contract nobody can read off the API, and it is how a panel comes to
    // depend on something we never published.
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: { id: 'tier-std', enabled: true, group: { enabled: true } }, service: null });
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '3877', link: 'https://t.co/x', quantity: '500' });
    expect(r.body).toEqual({ error: 'Incorrect service ID' });
    expect(createOrderForSession).not.toHaveBeenCalled();
  });
  it('a retired ID says discontinued, never 404', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: new Date(), tier: null, service: null });
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '9', link: 'https://t.co/x', quantity: '500' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ error: 'Service discontinued' });
  });
  it('passes the web path error through as { error }', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: null, service: { id: 's9', enabled: true, provider: 'dao', providerListedAt: new Date(), costPer1k: 2 } });
    createOrderForSession.mockResolvedValue(Response.json({ error: 'Insufficient balance' }, { status: 400 }));
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '3877', link: 'https://instagram.com/x', quantity: '1000' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ error: 'Insufficient balance' });
  });
});

describe('instructions', () => {
  // Every description now comes off the service itself — its apiType and its
  // drip-feed flag — because the API no longer serves a curated tier that could
  // carry hand-written group copy.
  const svc = (over) => ({
    name: 'A service', category: 'Other', platform: 'instagram',
    sellPer1k: 52000n, costPer1k: 0.2, min: 10, max: 10000,
    refill: false, cancel: false, dripfeed: false, apiType: 'Default',
    resellerMap: { apiId: 100, retiredAt: null }, ...over,
  });

  it('gives each service a standard type and the instructions its buyer needs', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      svc({ apiType: 'Custom Comments', resellerMap: { apiId: 104, retiredAt: null } }),
      svc({ apiType: 'Web Traffic', resellerMap: { apiId: 103, retiredAt: null } }),
      svc({ apiType: 'Default', dripfeed: true, resellerMap: { apiId: 105, retiredAt: null } }),
    ]);
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    const comments = r.body.find(x => x.service === 104);
    expect(comments.type).toBe('Custom Comments');
    expect(comments.description).toContain('one comment per line');
    const traffic = r.body.find(x => x.service === 103);
    expect(traffic.description).toContain('country');
    expect(traffic.description).toContain('referrer');
    const drip = r.body.find(x => x.service === 105);
    expect(drip.description).toContain('drip-feed');
  });

  it('never leaks the provider type straight through', async () => {
    mockPrisma.service.findMany.mockResolvedValue([svc({ apiType: 'Something Upstream Invented' })]);
    const r = await call({ key: 'k'.repeat(16), action: 'services' });
    expect(r.body[0].type).toBe('Default');
  });

  it('add folds traffic targeting and list parameters into the order', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: null, service: { id: 's-web', enabled: true, provider: 'dao', providerListedAt: new Date(), costPer1k: 2 } });
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-9', status: 'Processing' } }));
    const r = await call({ key: 'k'.repeat(16), action: 'add', service: '103', link: 'https://example.com', quantity: '1000', country: 'ng', device: 'Mobile', keyword: 'buy shoes lagos', usernames: 'a\nb' });
    expect(r.status).toBe(200);
    const [, body] = createOrderForSession.mock.calls[0];
    expect(body.trafficConfig).toEqual({ country: 'ng', device: 'mobile', trafficType: 'keyword', keyword: 'buy shoes lagos', referrer: '' });
    expect(body.comments).toBe('a\nb');
  });

  it('add without extras sends neither comments nor traffic', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ retiredAt: null, tier: null, service: { id: 's9', enabled: true, provider: 'dao', providerListedAt: new Date(), costPer1k: 2 } });
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-10', status: 'Processing' } }));
    await call({ key: 'k'.repeat(16), action: 'add', service: '4102', link: 'https://instagram.com/x', quantity: '100' });
    const [, body] = createOrderForSession.mock.calls[0];
    expect(body.comments).toBeUndefined();
    expect(body.trafficConfig).toBeUndefined();
  });
});

describe('status, refill, cancel', () => {
  it('maps Nitro statuses to the convention and only reads the reseller\'s own orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ orderId: 'NTR-1', status: 'Processing', charge: 272000, quantity: 1000, remains: 450, startCount: 1200 }]);
    const r = await call({ key: 'k'.repeat(16), action: 'status', order: 'NTR-1' });
    expect(r.body).toEqual({ charge: '2720.00', start_count: '1200', status: 'In progress', remains: '450', currency: 'NGN' });
    expect(mockPrisma.order.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', orderId: { in: ['NTR-1'] } });
  });
  it('multi-status keys by order and marks unknown ones', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ orderId: 'NTR-1', status: 'Completed', charge: 100, quantity: 10, remains: 0, startCount: 5 }]);
    const r = await call({ key: 'k'.repeat(16), action: 'status', orders: 'NTR-1,NTR-2' });
    expect(r.body['NTR-1'].status).toBe('Completed');
    expect(r.body['NTR-2']).toEqual({ error: 'Incorrect order ID' });
  });
  it('refill goes through the shared refill path', async () => {
    refillOrderForSession.mockResolvedValue(Response.json({ success: true }));
    const r = await call({ key: 'k'.repeat(16), action: 'refill', order: 'NTR-1' });
    expect(r.body).toEqual({ refill: '1' });
    expect(refillOrderForSession.mock.calls[0][1]).toBe('NTR-1');
  });
  it('cancel answers per order, with the web path\'s reason when it refuses', async () => {
    patchOrderForSession
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json({ error: 'Order already sent to provider' }, { status: 409 }));
    const r = await call({ key: 'k'.repeat(16), action: 'cancel', orders: 'NTR-1,NTR-2' });
    expect(r.body).toEqual([{ order: 'NTR-1', cancel: 1 }, { order: 'NTR-2', cancel: { error: 'Order already sent to provider' } }]);
  });
});
