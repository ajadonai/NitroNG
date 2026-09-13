import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { $queryRaw: (...a) => mocks.queryRaw(...a) } }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const { GET } = await import('@/app/api/cron/cohort-stats/acquisition/route');

const BASE = 'https://nitro.ng/api/cron/cohort-stats/acquisition';
const req = (qs = '', headers = {}) => new Request(`${BASE}${qs}`, { headers });
const dayRows = [
  { day: '2026-09-06', new_customers: 19, signups: 101 },
  { day: '2026-09-07', new_customers: 22, signups: 81 },
];
const cohortRows = [
  { week_start: '2026-08-31', signups: 736, bought_7d: 156, bought_30d: 158, matured_7d: true, matured_30d: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANALYTICS_READ_TOKEN = 'read-token';
  process.env.CRON_SECRET = 'cron-secret';
  mocks.queryRaw.mockResolvedValueOnce(dayRows).mockResolvedValueOnce(cohortRows);
});
afterEach(() => { delete process.env.ANALYTICS_READ_TOKEN; delete process.env.CRON_SECRET; });

describe('acquisition stats endpoint', () => {
  it('refuses without the read token and never touches the database', async () => {
    for (const r of [req('?since=2026-09-06&until=2026-09-07'), req('?token=wrong'), req('', { authorization: 'Bearer nope' })]) {
      const res = await GET(r);
      expect(res.status).toBe(401);
      expect(res.headers.get('cache-control')).toContain('no-store');
    }
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('answers the read token as a query param — what a fetcher without headers can send', async () => {
    const res = await GET(req('?token=read-token&since=2026-09-06&until=2026-09-07'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.scope).toBe('account');
    expect(body.since).toBe('2026-09-06');
    expect(body.until).toBe('2026-09-07');
    // The denominator the ads check could never get elsewhere, and nothing it can get elsewhere.
    expect(body.days).toEqual([
      { day: '2026-09-06', new_customers: 19, signups: 101, ad_spend_attributable: null },
      { day: '2026-09-07', new_customers: 22, signups: 81, ad_spend_attributable: null },
    ]);
    expect(body.cohorts[0]).toEqual({
      week_start: '2026-08-31', signups: 736,
      bought_7d: 156, rate_7d: 21.2, matured_7d: true,
      bought_30d: 158, rate_30d: 21.5, matured_30d: false,
    });
    expect(body.definitions.new_customers).toMatch(/first order in all of history/);
  });

  it('answers the cron secret as Bearer, and the read token as Bearer', async () => {
    expect((await GET(req('?since=2026-09-06&until=2026-09-07', { authorization: 'Bearer cron-secret' }))).status).toBe(200);
    mocks.queryRaw.mockResolvedValueOnce(dayRows).mockResolvedValueOnce(cohortRows);
    expect((await GET(req('?since=2026-09-06&until=2026-09-07', { authorization: 'Bearer read-token' }))).status).toBe(200);
  });

  it('refuses a malformed, inverted or oversized range before querying', async () => {
    for (const qs of ['?token=read-token&since=6-9-2026', '?token=read-token&since=2026-09-07&until=2026-09-06', '?token=read-token&since=2025-01-01&until=2026-09-12', '?token=read-token&since=2026-02-30&until=2026-03-01']) {
      const res = await GET(req(qs));
      expect(res.status, qs).toBe(400);
    }
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('defaults to the last 30 Lagos days', async () => {
    const res = await GET(req('?token=read-token'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const span = (new Date(body.until) - new Date(body.since)) / 86400000;
    expect(span).toBe(29);
  });

  it('passes the range to SQL as dates and asks for first-ever orders, not first-in-window', async () => {
    await GET(req('?token=read-token&since=2026-09-06&until=2026-09-07'));
    const [strings, ...values] = mocks.queryRaw.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toMatch(/MIN\(o\."createdAt"\)/);          // first order per user...
    expect(sql).toMatch(/GROUP BY o\."userId"/);
    expect(sql).not.toMatch(/o\."createdAt" >= \?/);        // ...over ALL history, not the window
    expect(values.every(v => v instanceof Date)).toBe(true);
  });

  it('lives under the robots-allowed prefix and leaves the protected files alone', () => {
    const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
    expect(robots).toContain('Allow: /api/cron/cohort-stats');
    // The sub-route needs no robots change of its own: the Allow line is a prefix match.
    expect('/api/cron/cohort-stats/acquisition'.startsWith('/api/cron/cohort-stats')).toBe(true);
  });
});
