import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The tracking-link panel printed "145.3% conversion".
 *
 * Two faults, and both of them are the same shape — a number describing one
 * period sitting beside a number describing another:
 *
 *   1. The panel offers 7 days / 30 days / All. The route's range map had no
 *      'all', so `rangeMs['all']` was undefined and the `||` quietly fell
 *      through to a week. On alabi-ad the All view showed 2,384 clicks against
 *      a true 30,664, and ₦352,109 of revenue against ₦4,180,578.
 *   2. The Signups and Orders cards read the link list's all-time totals while
 *      the Clicks card read this route's windowed count. 3,465 signups over
 *      2,384 clicks is 145.3%, and a conversion above 100% is not a rounding
 *      error — it is two different questions sharing a percentage sign.
 */
const mocks = vi.hoisted(() => ({
  clickCount: vi.fn(), userCount: vi.fn(), groupBy: vi.fn(), queryRaw: vi.fn(), findUnique: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    linkClick: { count: (...a) => mocks.clickCount(...a), groupBy: (...a) => mocks.groupBy(...a) },
    user: { count: (...a) => mocks.userCount(...a) },
    acquisitionLink: { findUnique: (...a) => mocks.findUnique(...a) },
    $queryRaw: (...a) => mocks.queryRaw(...a),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/admin', () => ({ requireAdmin: async () => ({ error: null }) }));

const { GET } = await import('@/app/api/admin/acquisition/analytics/route');
const src = readFileSync(new URL('../app/api/admin/acquisition/analytics/route.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/admin-extra-pages.jsx', import.meta.url), 'utf8');

const call = async (range) => {
  const res = await GET(new Request(`http://x/api/admin/acquisition/analytics?linkId=L1&range=${range}`));
  return res.json();
};
/** The lower bound the signup count was asked for — the window, as the route sees it. */
const signupSince = () => mocks.userCount.mock.calls.at(-1)[0].where.createdAt.gte;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue({ slug: 'alabi-ad' });
  mocks.clickCount.mockResolvedValue(30664);
  mocks.userCount.mockResolvedValue(3465);
  mocks.groupBy.mockResolvedValue([]);
  // uniques, both timelines, then the revenue row.
  mocks.queryRaw.mockImplementation(async (strings) => {
    const sql = Array.isArray(strings) ? strings.join(' ') : String(strings);
    if (sql.includes('DISTINCT')) return [{ cnt: 18418 }];
    if (sql.includes('FROM orders')) return [{ orders: 3798n, revenue: 418057800n, cost: 129345600n }];
    return [];
  });
});

describe('the range the panel asks for is the range it gets', () => {
  it('reads "all" as all of it, not as a week', async () => {
    await call('all');
    expect(signupSince().getTime()).toBe(0);
  });

  it('still keeps the windows that already worked', async () => {
    const day = 86400000;
    for (const [range, days] of [['24h', 1], ['7d', 7], ['30d', 30]]) {
      await call(range);
      const ago = Date.now() - signupSince().getTime();
      expect(Math.round(ago / day), range).toBe(days);
    }
  });

  it('falls back to a week only for a range nobody offers', async () => {
    // The fallback is not the bug and stays. What was wrong is that a button
    // the panel actually shows was landing on it.
    await call('nonsense');
    expect(Math.round((Date.now() - signupSince().getTime()) / 86400000)).toBe(7);
    expect(src).toMatch(/const rangeMs = \{ '24h': 86400000, '7d': 604800000, '30d': 2592000000 \};/);
    expect(src).toMatch(/range === 'all' \? new Date\(0\)/);
  });
});

describe('every figure in the card row describes one period', () => {
  it('counts signups inside the window rather than for all time', async () => {
    const d = await call('7d');
    expect(d.periodSignups).toBe(3465);
    expect(mocks.userCount).toHaveBeenCalledWith({
      where: { signupSource: 'alabi-ad', deletedAt: null, createdAt: { gte: expect.any(Date) } },
    });
  });

  it('builds the conversion from the windowed signups, not the list row', () => {
    expect(panel).toMatch(/const periodSignups = analytics\.periodSignups \?\? link\.signups \?\? 0;/);
    expect(panel).toMatch(/const convRate = analytics\.totalClicks > 0 \? \(\(periodSignups \/ analytics\.totalClicks\) \* 100\)/);
    expect(panel).toMatch(/const orderRate = periodSignups > 0 \? \(\(periodOrders \/ periodSignups\) \* 100\)/);
    expect(panel, 'no card may read the all-time totals directly').not.toMatch(/\(link\.signups \|\| 0\)\.toLocaleString\(\)/);
    expect(panel).not.toMatch(/\(link\.orders \|\| 0\)\.toLocaleString\(\)/);
  });

  it('treats a genuine zero as an answer rather than as a missing value', () => {
    // `||` read a quiet week as "no data" and substituted the all-time figure,
    // which is the same bug one level down.
    expect(panel).toMatch(/const periodRevenue = analytics\.periodRevenue \?\? \(link\.revenue \|\| 0\) \/ 100;/);
    expect(panel).toMatch(/fN\(analytics\.periodProfit \?\? 0\)/);
  });

  it('labels the chart with the range that is actually selected', () => {
    // On "all" the caption fell through to "Last 30 days", so the header and
    // the chart under it disagreed on screen.
    expect(panel).toMatch(/range === "all" \? "All time"/);
  });
});

describe('the money survives a big link', () => {
  it('sums as bigint, because kobo outgrows a 32-bit int', async () => {
    // ::int throws above 2,147,483,647 — about ₦21.5m of charge. alabi-ad is
    // already at ₦4.18m, and "all" is the view that reaches the ceiling first.
    expect(src).toMatch(/COALESCE\(SUM\(o\.charge\),0\)::bigint AS revenue/);
    expect(src).toMatch(/COALESCE\(SUM\(o\.cost\),0\)::bigint AS cost/);
  });

  it('hands back a number the response can actually carry', async () => {
    // A BigInt cannot be JSON-serialised; leaving one in the payload would 500
    // the route for exactly the links that earned the most.
    const d = await call('all');
    expect(d.periodRevenue).toBe(4180578);
    expect(d.periodOrders).toBe(3798);
    expect(d.periodProfit).toBe(2887122);
    expect(typeof d.periodRevenue).toBe('number');
  });
});
