import { describe, expect, it, vi, beforeEach } from 'vitest';
import { trafficProviderParams } from '@/lib/traffic-targets';

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

// The provider names these fields differently from every other service type and
// expects numbers where our UI uses words. Sending our own vocabulary produced
// "device_type.blank" regardless of value, because nothing was being read.
describe('traffic parameters match the provider spec', () => {
  it('maps a keyword order to their exact field names and codes', () => {
    expect(trafficProviderParams({ country: 'US', device: 'all', trafficType: 'keyword', keyword: 'breaking news' }))
      .toEqual({ country: 'US', device: 5, type_of_traffic: 1, google_keyword: 'breaking news' });
  });

  it('maps a referrer order to referring_url, not referrer', () => {
    expect(trafficProviderParams({ country: 'UK', device: 'desktop', trafficType: 'referrer', referrer: 'https://x.com' }))
      .toEqual({ country: 'UK', device: 1, type_of_traffic: 2, referring_url: 'https://x.com' });
  });

  it('sends no keyword or referrer for blank-referrer traffic', () => {
    expect(trafficProviderParams({ country: 'WW', device: 'ios', trafficType: 'blank' }))
      .toEqual({ country: 'WW', device: 3, type_of_traffic: 3 });
  });

  it('maps every device our forms offer to a provider code', () => {
    for (const [ours, code] of [['all', 5], ['desktop', 1], ['mobile', 4], ['android', 2], ['ios', 3]]) {
      expect(trafficProviderParams({ country: 'US', device: ours, trafficType: 'blank' }).device).toBe(code);
    }
  });

  it('returns null when an order has no targeting', () => {
    expect(trafficProviderParams(null)).toBeNull();
  });
});

describe('dispatch carries the translated parameters', () => {
  it('sends the provider spec end to end', async () => {
    await placeWithProvider({
      id: 'o1',
      service: { apiId: 7593, provider: 'dao', apiType: 'Web Traffic' },
      link: 'https://example.com/',
      quantity: 415,
      trafficConfig: { country: 'US', device: 'all', trafficType: 'keyword', keyword: 'breaking news' },
    });
    const [, , , , extra] = smm.placeOrder.mock.calls[0];
    expect(extra).toMatchObject({ country: 'US', device: 5, type_of_traffic: 1, google_keyword: 'breaking news' });
  });

  it('leaves ordinary orders untouched', async () => {
    await placeWithProvider({
      id: 'o2',
      service: { apiId: 100, provider: 'mtp', apiType: 'Default' },
      link: 'https://instagram.com/x',
      quantity: 100,
    });
    const [, , , , extra] = smm.placeOrder.mock.calls[0];
    expect(extra.country).toBeUndefined();
    expect(extra.type_of_traffic).toBeUndefined();
  });
});
