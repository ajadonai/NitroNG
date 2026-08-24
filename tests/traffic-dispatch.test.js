import { describe, expect, it, vi, beforeEach } from 'vitest';

const smm = { placeOrder: vi.fn() };
vi.mock('@/lib/smm', () => smm);
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(null) },
    adminIssue: { create: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { placeWithProvider } = await import('@/lib/bulk-dispatch');

beforeEach(() => {
  smm.placeOrder.mockReset();
  smm.placeOrder.mockResolvedValue({ order: 999 });
  process.env.NODE_ENV = 'test';
});

// Two separate bugs sent every traffic order out with a blank country: the
// payload builder dropped the field, and every dispatch caller rebuilt the
// order object without trafficConfig. This asserts the whole chain.
describe('web traffic dispatch', () => {
  it('sends country, device and keyword through to the provider', async () => {
    await placeWithProvider({
      id: 'o1',
      service: { apiId: 7593, provider: 'dao', apiType: 'Web Traffic' },
      link: 'https://example.com/',
      quantity: 415,
      trafficConfig: { country: 'US', device: 'all', trafficType: 'keyword', keyword: 'breaking news' },
    });
    const [, , , , extra] = smm.placeOrder.mock.calls[0];
    expect(extra.country).toBe('US');
    expect(extra.device).toBe('all');
    expect(extra.keywords).toBe('breaking news');
  });

  it('sends a referrer when that is the traffic type', async () => {
    await placeWithProvider({
      id: 'o2',
      service: { apiId: 7593, provider: 'dao', apiType: 'Web Traffic' },
      link: 'https://example.com/',
      quantity: 100,
      trafficConfig: { country: 'WW', device: 'mobile', trafficType: 'referrer', referrer: 'https://x.com' },
    });
    const [, , , , extra] = smm.placeOrder.mock.calls[0];
    expect(extra.country).toBe('WW');
    expect(extra.referrer).toBe('https://x.com');
  });

  it('sends nothing extra for an ordinary order', async () => {
    await placeWithProvider({
      id: 'o3',
      service: { apiId: 100, provider: 'mtp', apiType: 'Default' },
      link: 'https://instagram.com/x',
      quantity: 100,
    });
    const [, , , , extra] = smm.placeOrder.mock.calls[0];
    expect(extra.country).toBeUndefined();
  });
});
