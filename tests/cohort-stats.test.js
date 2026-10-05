import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTx = { $queryRaw: vi.fn() };
const prisma = {
  $transaction: vi.fn((fn) => fn(mockTx)),
  setting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};
const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log }));
global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

const { GET } = await import('@/app/api/cron/cohort-stats/route');

function request(token = 'analytics') {
  return new Request('http://localhost/api/cron/cohort-stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function snapshot(generatedAt = '2026-07-08T01:01:48.043Z') {
  return {
    generatedAt,
    windows: {
      '7d': { signups: 1, depositors: 1, depositRate: 1, totalDepositedNGN: 1000, avgFirstDepositNGN: 1000, bySource: [] },
      '30d': { signups: 1, depositors: 1, depositRate: 1, totalDepositedNGN: 1000, avgFirstDepositNGN: 1000, bySource: [] },
    },
  };
}

function statsRow({ signups = 4, depositors = 2, totalDepositedKobo = 500000 } = {}) {
  return [{
    signups,
    depositors,
    totalDepositedKobo: BigInt(totalDepositedKobo),
    // First deposits are a subset of the total: 300,000 of the 500,000 kobo
    // here is first-deposit money, the other 200,000 is repeat deposits.
    firstDepositKobo: BigInt(300000),
    bySource: [
      { source: 'organic/direct', signups: 3, depositors: 1, firstDepositKobo: BigInt(100000), allDepositKobo: BigInt(150000) },
      { source: 'instagram', signups: 1, depositors: 1, firstDepositKobo: BigInt(200000), allDepositKobo: BigInt(350000) },
    ],
  }];
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'cron';
  process.env.ANALYTICS_READ_TOKEN = 'analytics';
  process.env.TG_BOT_TOKEN = 'test-token';
  process.env.TG_CHAT_ID = '-100123';
  prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify(snapshot()) });
  prisma.setting.upsert.mockResolvedValue({});
  prisma.$transaction.mockImplementation((fn) => fn(mockTx));
  mockTx.$queryRaw.mockResolvedValue(statsRow());
});

describe('GET /api/cron/cohort-stats', () => {
  it('self-heals a stale reader snapshot and stores the fresh result', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).not.toBe('2026-07-08T01:01:48.043Z');
    expect(body.stale).toBeUndefined();
    expect(body.windows['7d']).toMatchObject({
      signups: 4,
      depositors: 2,
      depositRate: 0.5,
      totalDepositedNGN: 5000,
      avgFirstDepositNGN: 2500,
    });
    expect(body.windows['7d'].bySource[0]).toMatchObject({
      source: 'organic/direct',
      signups: 3,
      depositors: 1,
      depositRate: 0.3333,
    });
    // Two separate transactions (7d + 30d), each with SET LOCAL + query = 4 calls
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(4);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'cohort_stats_snapshot' },
      update: expect.objectContaining({ value: expect.any(String) }),
    }));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Stale snapshot detected'));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Self-healed stale snapshot'));
    expect(log.info).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Query durations:'));
  });

  it('serves stale fallback with stale metadata and alerts WatchTower when self-heal fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('database timeout'));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe('2026-07-08T01:01:48.043Z');
    expect(body.stale).toBe(true);
    expect(body.ageHours).toBeGreaterThan(0);
    expect(log.error).toHaveBeenCalledWith('Cohort Stats', 'Live recompute failed: database timeout');
    expect(log.error).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Serving stale snapshot'));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Query durations (failed)'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('writer computes with separate transactions and stores the snapshot', async () => {
    const response = await GET(request('cron'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    // Two separate transactions (7d + 30d)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
    expect(prisma.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'cohort_stats_snapshot' },
    }));
    expect(log.info).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Snapshot written'));
    expect(log.info).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Query durations:'));
  });

  it('writer alerts WatchTower on failure', async () => {
    prisma.$transaction.mockRejectedValue(new Error('statement timeout'));

    const response = await GET(request('cron'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Writer failed');
    expect(log.error).toHaveBeenCalledWith('Cohort Stats', 'Writer failed: statement timeout');
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Query durations (failed)'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns 401 with no-cache headers for unauthorized requests', async () => {
    const response = await GET(request('bad-token'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store');
  });

  it('rejects CRON_SECRET supplied through the query string', async () => {
    const response = await GET(new Request('http://localhost/api/cron/cohort-stats?token=cron'));
    expect(response.status).toBe(401);
  });

  it('accepts ANALYTICS_READ_TOKEN via query string (read-only path)', async () => {
    const response = await GET(new Request('http://localhost/api/cron/cohort-stats?token=analytics'));
    expect(response.status).toBe(200);
  });

  it('fails closed when the matching server credential is not configured', async () => {
    delete process.env.ANALYTICS_READ_TOKEN;
    const response = await GET(request('analytics'));
    expect(response.status).toBe(401);
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
  });

  it('serves fresh snapshot without self-heal when not stale', async () => {
    const fresh = snapshot(new Date().toISOString());
    prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify(fresh) });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe(fresh.generatedAt);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });
});

/**
 * Deposit return measurement, 5 Oct 2026. Deposit money per source is what
 * lets ad spend be divided out into a return figure; before this the only
 * money number was an average times a count, and `bySource` carried no money
 * at all, so the return could only be worked out by hand.
 *
 * This route is protected — the nightly cohort check depends on it — so these
 * also pin the things that must stay true alongside the new fields.
 */
describe('deposit money for the return calculation', () => {
  async function windows() {
    process.env.CRON_SECRET = 'cron';
    prisma.setting.upsert.mockResolvedValue({});
    const res = await GET(request('cron'));
    expect(res.status).toBe(200);
    return JSON.parse(prisma.setting.upsert.mock.calls[0][0].update.value).windows;
  }

  it('sums first-deposit and all-deposit money per window', async () => {
    const w = await windows();
    // 300,000 kobo of first deposits, 500,000 kobo in total.
    expect(w['7d'].firstDepositNaira).toBe(3000);
    expect(w['7d'].allDepositNaira).toBe(5000);
  });

  it('carries both money figures per source, which is where spend divides out', async () => {
    const w = await windows();
    const ig = w['7d'].bySource.find((s) => s.source === 'instagram');
    expect(ig.firstDepositNaira).toBe(2000);
    expect(ig.allDepositNaira).toBe(3500);
  });

  it('per-source money sums to the window total, so no source is lost', async () => {
    const w = await windows();
    const sum = (k) => w['7d'].bySource.reduce((t, s) => t + s[k], 0);
    expect(sum('firstDepositNaira')).toBe(w['7d'].firstDepositNaira);
    expect(sum('allDepositNaira')).toBe(w['7d'].allDepositNaira);
  });

  it('keeps every field the nightly check and the deposit log already read', async () => {
    const w = await windows();
    for (const key of ['signups', 'depositors', 'depositRate', 'totalDepositedNGN', 'avgFirstDepositNGN', 'bySource']) {
      expect(w['7d'], key).toHaveProperty(key);
      expect(w['30d'], key).toHaveProperty(key);
    }
    for (const key of ['source', 'signups', 'depositors', 'depositRate']) {
      expect(w['7d'].bySource[0]).toHaveProperty(key);
    }
  });

  // avgFirstDepositNGN has never been an average first deposit — it is total
  // divided by depositors. Left under its old name because the log has read it
  // for weeks; this pins the difference so nobody "fixes" one into the other.
  it('leaves the misnamed average alone and reports the real first deposit beside it', async () => {
    const w = await windows();
    expect(w['7d'].avgFirstDepositNGN).toBe(2500); // 500,000 kobo / 2 depositors
    expect(w['7d'].firstDepositNaira).toBe(3000);  // actual first-deposit money
    expect(w['7d'].firstDepositNaira).not.toBe(w['7d'].avgFirstDepositNGN * w['7d'].depositors);
  });

  // Bonus credit is type 'bonus', so filtering to 'deposit' is what keeps the
  // return figure on real money moved. The window function is what isolates a
  // first deposit; nothing else in the route can.
  it('counts deposits only, never bonus credit, and ranks them to find the first', async () => {
    await windows();
    const sql = mockTx.$queryRaw.mock.calls
      .map((c) => (Array.isArray(c[0]) ? c[0].join('?') : String(c[0])))
      .join('\n');
    expect(sql).toContain("type = 'deposit'");
    expect(sql).toContain("status = 'Completed'");
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).not.toContain("type = 'bonus'");
  });
});
