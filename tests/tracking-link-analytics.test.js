import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { windowFor, snap, fill, RANGES } from '@/lib/acquisition-window';

/**
 * The tracking-link panel, and the seven faults reviewed on 15 Sep.
 *
 * Five of them were one bug wearing different clothes: nobody agreed what "the
 * last 30 days" meant. It meant now minus 30×86400000, which lands mid-afternoon
 * on the 31st date back and drew a stub first bar — 65 clicks against a 408
 * average on alabi-ad, a 6× dip that never happened. It meant whatever days the
 * database returned, so a month with traffic on ten days drew ten bars and
 * called it thirty. At 24h it meant the hour digit, so a window opening at 20:00
 * drew yesterday's 21:00–23:00 at the far right, after today's 20:00.
 *
 * The other two: the card row mixed an all-time numerator with a windowed
 * denominator and printed 142.5% conversion, and 30 days was the longest range
 * on offer for links three months old.
 */
const mocks = vi.hoisted(() => ({
  clickCount: vi.fn(), clickFirst: vi.fn(), userCount: vi.fn(),
  groupBy: vi.fn(), queryRaw: vi.fn(), linkFind: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    linkClick: {
      count: (...a) => mocks.clickCount(...a),
      groupBy: (...a) => mocks.groupBy(...a),
      findFirst: (...a) => mocks.clickFirst(...a),
    },
    user: { count: (...a) => mocks.userCount(...a) },
    acquisitionLink: { findUnique: (...a) => mocks.linkFind(...a) },
    $queryRaw: (...a) => mocks.queryRaw(...a),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/admin', () => ({ requireAdmin: async () => ({ error: null }) }));

const { GET } = await import('@/app/api/admin/acquisition/analytics/route');
const routeSrc = readFileSync(new URL('../app/api/admin/acquisition/analytics/route.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/admin-extra-pages.jsx', import.meta.url), 'utf8');

const call = async (range) => {
  const res = await GET(new Request(`http://x/api/admin/acquisition/analytics?linkId=L1&range=${range}`));
  return res.json();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.linkFind.mockResolvedValue({ slug: 'alabi-ad', createdAt: new Date('2026-06-10T16:20:00Z') });
  mocks.clickFirst.mockResolvedValue({ createdAt: new Date('2026-06-16T14:27:00Z') });
  mocks.clickCount.mockResolvedValue(11726);
  mocks.userCount.mockResolvedValue(1179);
  mocks.groupBy.mockResolvedValue([]);
  mocks.queryRaw.mockImplementation(async (strings) => {
    const sql = Array.isArray(strings) ? strings.join(' ') : String(strings);
    if (sql.includes('DISTINCT')) return [{ cnt: 7747 }];
    if (sql.includes('FROM orders')) return [{ orders: 1494n, revenue: 175625800n, cost: 60000000n }];
    return [];  // the two series, deliberately empty so the zero-fill is visible
  });
});

describe('the window means what it says', () => {
  it('covers whole slots, never a fraction of one', () => {
    // now - 30 days lands mid-afternoon, so "Last 30 days" drew 31 bars.
    const w = windowFor('30d', { now: new Date('2026-09-15T14:23:00Z') });
    expect(w.slots).toBe(30);
    expect((w.end - w.start) / 86400000).toBe(30);
  });

  it('cuts the day in Lagos, not in UTC', () => {
    // createdAt is a plain timestamp, so DATE() cuts at midnight UTC — 1am in
    // Lagos. 1,935 of 44,500 clicks land in that hour and were filed on the day
    // before the one they happened on.
    expect(snap(new Date('2026-09-15T00:30:00Z'), 'day').toISOString()).toBe('2026-09-14T23:00:00.000Z');
    expect(routeSrc).toMatch(/AT TIME ZONE 'UTC' AT TIME ZONE \$\{LAGOS\}/);
    expect(routeSrc).not.toMatch(/EXTRACT\(HOUR/);
    expect(routeSrc).not.toMatch(/GROUP BY bucket/);
  });

  it('starts weeks where Postgres starts them', () => {
    // date_trunc('week') cuts on Monday. The first All-time chart drew fourteen
    // weekly slots, every one empty, over a link with 30,699 clicks, because
    // the fill was aligned to the first click instead.
    const w = snap(new Date('2026-06-10T16:20:01Z'), 'week');   // a Wednesday
    expect(w.toISOString()).toBe('2026-06-07T23:00:00.000Z');    // Monday 8 Jun, Lagos
  });

  it('opens All at the first click, in whole weeks', () => {
    const w = windowFor('all', { now: new Date('2026-09-16T11:00:00Z'), firstAt: '2026-06-16T14:27:00Z' });
    expect(w.bucket).toBe('week');
    expect(w.start.getTime()).toBeLessThanOrEqual(new Date('2026-06-16T14:27:00Z').getTime());
    expect((w.end - w.start) / 604800000).toBe(w.slots);
  });
});

describe('every slot is drawn, including the empty ones', () => {
  it('emits one slot per bucket whatever the database returned', async () => {
    // GROUP BY DATE() sends no row for a day with nothing in it, and the chart
    // plotted the rows it received: ten bars for a month, with three weeks of
    // silence not drawn as quiet but not drawn at all.
    for (const [range, slots] of [['24h', 24], ['7d', 7], ['30d', 30], ['90d', 90]]) {
      const d = await call(range);
      expect(d.timeline, range).toHaveLength(slots);
      expect(d.slots, range).toBe(slots);
      expect(d.timeline.every(s => s.clicks === 0), range).toBe(true);
    }
  });

  it('marks the slot still being written to', async () => {
    const d = await call('7d');
    expect(d.timeline.filter(s => s.partial)).toHaveLength(1);
    expect(d.timeline[d.timeline.length - 1].partial).toBe(true);
  });

  it('puts both series on the same slots', () => {
    // The overlay was a second chart with its own length and its own maximum,
    // so bar 4 of one was not the same date as bar 4 of the other.
    const w = windowFor('7d', { now: new Date('2026-09-15T14:00:00Z') });
    const out = fill(w, [{ bucket: new Date(w.start.getTime() + 2 * 86400000).toISOString(), clicks: 5 }]);
    expect(out[2].clicks).toBe(5);
    expect(out.map(s => s.at)).toEqual([...new Set(out.map(s => s.at))]);
    expect(routeSrc).toMatch(/signupByBucket\.get\(new Date\(slot\.at\)\.getTime\(\)\)/);
  });
});

describe('the ranges the panel offers', () => {
  it('offers 90 days and all time, and buckets each to fit', () => {
    // 30 days was the longest on offer; alabi-ad is 92 days old and 60% of its
    // history could not be opened.
    expect(Object.keys(RANGES)).toEqual(['24h', '7d', '30d', '90d', 'all']);
    expect(RANGES['24h'].bucket).toBe('hour');
    expect(RANGES['90d'].bucket).toBe('day');
    expect(RANGES.all.bucket).toBe('week');
    expect(panel).toMatch(/\["24h", "7d", "30d", "90d", "all"\]/);
  });

  it('falls back to a week for a range nobody offers', async () => {
    const d = await call('nonsense');
    expect(d.range).toBe('7d');
    expect(d.slots).toBe(7);
  });
});

describe('the card row describes one period, and says so', () => {
  it('scopes signups, orders and revenue to the window', async () => {
    const d = await call('30d');
    expect(d.periodSignups).toBe(1179);
    expect(d.periodOrders).toBe(1494);
    expect(d.periodRevenue).toBe(1756258);
    expect(d.periodProfit).toBe(1156258);
  });

  it('keeps the lifetime figures, on a strip that names them', async () => {
    const d = await call('30d');
    expect(d.lifetime.clicks).toBe(11726);
    expect(d.lifetime.since).toBe('2026-06-16T14:27:00.000Z');
    expect(panel).toMatch(/All time\{analytics\.lifetime\.since/);
    expect(panel, 'no card may read an all-time total').not.toMatch(/\(link\.signups \|\| 0\)\.toLocaleString\(\)/);
  });

  it('anchors "since" to the first click on every range, not only on All', async () => {
    // It used to mean the link's creation date on four ranges and its first
    // click on the fifth.
    const a = await call('7d');
    const b = await call('all');
    expect(a.lifetime.since).toBe(b.lifetime.since);
  });

  it('prints an em dash where there is nothing to divide by', () => {
    // "0.0% conversion" on a link with no clicks in the window is a
    // measurement nobody took, printed as though it were a result.
    expect(panel).toMatch(/analytics\.totalClicks > 0 \? `\$\{\(\(periodSignups \/ analytics\.totalClicks\) \* 100\)\.toFixed\(1\)\}% conversion` : "\\u2014"/);
    expect(panel).toMatch(/periodSignups > 0 \? .*% of signups` : "\\u2014"/);
  });

  it('treats a genuine zero as an answer rather than a missing value', () => {
    expect(panel).toMatch(/const periodRevenue = analytics\.periodRevenue \?\? \(link\.revenue \|\| 0\) \/ 100;/);
  });
});

describe('the chart says what it is showing', () => {
  it('names the real window rather than captioning it "Today"', () => {
    // The 24h caption read "Today, by hour" for a rolling window across two
    // dates.
    expect(panel).toMatch(/const fmtWindow = \(\) => \{/);
    // The caption is the computed window now. Matched on what is rendered
    // rather than on the whole file, since the comment above it still quotes
    // the old string to say what was wrong with it.
    expect(panel).toMatch(/style=\{\{ color: t\.textMuted \}\}>\{fmtWindow\(\)\}<\/div>/);
    expect(panel).not.toMatch(/range === "24h" \? "Today, by hour"/);
    expect(panel).toMatch(/<TimelineChart slots=\{slots\}/);
  });

  it('labels every range instead of hiding the axis above 14 buckets', () => {
    expect(panel).not.toMatch(/timelineLabels\.length <= 14/);
    expect(panel).toMatch(/const step = Math\.max\(1, Math\.round\(slots\.length \/ 5\)\);/);
  });

  it('draws an empty bucket as a floor and names each peak', () => {
    expect(panel).toMatch(/sl\.clicks === 0 \? '2px'/);
    expect(panel).toMatch(/Clicks · peak \{clickPeak\.toLocaleString\(\)\}/);
    expect(panel).toMatch(/Signups · own scale, peak \{signupPeak\.toLocaleString\(\)\}/);
  });
});

describe('the money survives a big link', () => {
  it('sums as bigint and hands back a number', async () => {
    // ::int throws above 2,147,483,647 kobo — about ₦21.5m — and All is the
    // view that reaches that ceiling first. A BigInt cannot be JSON-serialised,
    // so leaving one in the payload would 500 exactly the links that earned most.
    expect(routeSrc).toMatch(/COALESCE\(SUM\(o\.charge\),0\)::bigint AS revenue/);
    const d = await call('all');
    expect(typeof d.periodRevenue).toBe('number');
    expect(typeof d.lifetime.revenue).toBe('number');
  });
});
