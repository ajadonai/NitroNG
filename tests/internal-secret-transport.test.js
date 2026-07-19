import { readFile } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = global.fetch;
const originalCronSecret = process.env.CRON_SECRET;
const originalAnalyticsToken = process.env.ANALYTICS_READ_TOKEN;

const mocks = vi.hoisted(() => ({
  getApplicationUrl: vi.fn(() => 'https://nitro.example'),
  requireAdmin: vi.fn(async () => ({ admin: { name: 'Test Admin' }, error: null })),
  logActivity: vi.fn(),
  settingFindUnique: vi.fn(),
  settingUpsert: vi.fn(),
  activityLogCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    setting: {
      findUnique: (...args) => mocks.settingFindUnique(...args),
      upsert: (...args) => mocks.settingUpsert(...args),
    },
    activityLog: { create: (...args) => mocks.activityLogCreate(...args) },
  },
}));
vi.mock('@/lib/env', () => ({ getApplicationUrl: (...args) => mocks.getApplicationUrl(...args) }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mocks.requireAdmin(...args),
  logActivity: (...args) => mocks.logActivity(...args),
  canPerformAction: vi.fn(() => true),
}));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/smm', () => ({
  checkOrder: vi.fn(),
  placeOrder: vi.fn(),
  refillOrder: vi.fn(),
  getBalance: vi.fn(),
  getServices: vi.fn(),
  isProviderConfigured: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  walletCreditEmail: vi.fn(),
  batchCompletionEmail: vi.fn(),
}));
vi.mock('@/lib/bulk-dispatch', () => ({ placeWithProvider: vi.fn() }));
vi.mock('@/lib/telegram', () => ({
  tgRefund: vi.fn(),
  tgOrderCancelled: vi.fn(),
  tgRefundAlert: vi.fn(),
  tgDripTimeout: vi.fn(),
  tgDigest: vi.fn(),
  tgFxUpdate: vi.fn(),
}));
vi.mock('@/lib/commissions', () => ({ createCommission: vi.fn(), voidCommissions: vi.fn() }));
vi.mock('@/lib/nitro-rewards', () => ({
  reverseOrderPoints: vi.fn(),
  computeRefundSplit: vi.fn(),
  getTotalRefundedKobo: vi.fn(),
  awardPointsOnCompletion: vi.fn(),
}));

const [
  { GET: getOrders },
  { GET: getDrip },
  { GET: getDigest },
  { GET: getRefill },
  { GET: getCohortStats },
  { GET: getFx },
  { POST: postAdminIssues },
] = await Promise.all([
  import('@/app/api/cron/orders/route'),
  import('@/app/api/cron/drip/route'),
  import('@/app/api/cron/digest/route'),
  import('@/app/api/cron/refill/route'),
  import('@/app/api/cron/cohort-stats/route'),
  import('@/app/api/cron/fx/route'),
  import('@/app/api/admin/issues/route'),
]);

const queryAuthenticatedRoutes = [
  ['orders', getOrders, 'secret', 'cron-secret'],
  ['drip', getDrip, 'secret', 'cron-secret'],
  ['digest', getDigest, 'secret', 'cron-secret'],
  ['refill', getRefill, 'secret', 'cron-secret'],
  ['cohort-stats cron writer', getCohortStats, 'token', 'cron-secret'],
  ['cohort-stats analytics reader', getCohortStats, 'token', 'analytics-secret'],
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'cron-secret';
  process.env.ANALYTICS_READ_TOKEN = 'analytics-secret';
  mocks.getApplicationUrl.mockReturnValue('https://nitro.example');
  mocks.requireAdmin.mockResolvedValue({ admin: { name: 'Test Admin' }, error: null });
  mocks.settingFindUnique.mockImplementation(({ where }) => {
    const values = {
      markup_usd_buffer: '200',
      markup_fx_threshold: '20',
      markup_usd_rate: '1700',
      markup_usd_market: '1500',
    };
    return Promise.resolve(values[where.key] ? { value: values[where.key] } : null);
  });
  mocks.settingUpsert.mockResolvedValue({});
  mocks.activityLogCreate.mockResolvedValue({});
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalAnalyticsToken === undefined) delete process.env.ANALYTICS_READ_TOKEN;
  else process.env.ANALYTICS_READ_TOKEN = originalAnalyticsToken;
});

describe('internal secret transport', () => {
  it.each(queryAuthenticatedRoutes)('rejects %s credentials supplied only in the query string', async (name, handler, parameter, secret) => {
    const request = new Request(`https://attacker.example/api/cron/test?${parameter}=${secret}`);
    const response = await handler(request);
    expect(response.status).toBe(401);
  });

  it('uses a strict Bearer header parser', async () => {
    const { getBearerToken } = await import('@/lib/bearer-token');
    expect(getBearerToken(new Request('https://nitro.example', {
      headers: { Authorization: 'Bearer cron-secret' },
    }))).toBe('cron-secret');
    expect(getBearerToken(new Request('https://nitro.example', {
      headers: { Authorization: 'Basic cron-secret' },
    }))).toBeNull();
    expect(getBearerToken(new Request('https://nitro.example', {
      headers: { Authorization: 'Bearer cron-secret trailing-data' },
    }))).toBeNull();
  });

  it('contains no query-secret fallback in the protected route sources', async () => {
    const paths = [
      'app/api/cron/orders/route.js',
      'app/api/cron/drip/route.js',
      'app/api/cron/digest/route.js',
      'app/api/cron/refill/route.js',
      'app/api/cron/cohort-stats/route.js',
    ];
    for (const path of paths) {
      const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
      expect(source).toContain('getBearerToken(req)');
      expect(source).not.toMatch(/searchParams\.get\(['"](?:secret|token)['"]\)/);
    }
  });
});

describe('canonical internal origins', () => {
  it('fires admin crons against the configured application URL, not the request host', async () => {
    global.fetch = vi.fn(async () => Response.json({ ok: true }));
    const request = new Request('https://attacker.example/api/admin/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fire_crons' }),
    });

    const response = await postAdminIssues(request);

    expect(response.status).toBe(200);
    expect(mocks.getApplicationUrl).toHaveBeenCalledWith();
    expect(global.fetch).toHaveBeenCalledTimes(7);
    for (const [url, options] of global.fetch.mock.calls) {
      expect(url).toMatch(/^https:\/\/nitro\.example\/api\/cron\//);
      expect(url).not.toContain('attacker.example');
      expect(options.headers.Authorization).toBe('Bearer cron-secret');
    }
  });

  it('triggers repricing against the configured application URL, not the request host', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === 'https://open.er-api.com/v6/latest/USD') {
        return Response.json({ rates: { NGN: 1600 } });
      }
      return Response.json({ repriced: 12 });
    });
    const request = new Request('https://attacker.example/api/cron/fx', {
      headers: { Authorization: 'Bearer cron-secret' },
    });

    const response = await getFx(request);

    expect(response.status).toBe(200);
    expect(mocks.getApplicationUrl).toHaveBeenCalledWith();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://nitro.example/api/cron/prices',
      { headers: { Authorization: 'Bearer cron-secret' } },
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('attacker.example'),
      expect.anything(),
    );
  });

  it('does not derive either internal origin from req.url', async () => {
    for (const path of ['app/api/admin/issues/route.js', 'app/api/cron/fx/route.js']) {
      const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
      expect(source).toContain('getApplicationUrl()');
      expect(source).not.toContain('new URL(req.url).origin');
    }
  });
});
