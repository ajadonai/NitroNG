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
    bySource: [
      { source: 'organic/direct', signups: 3, depositors: 1 },
      { source: 'instagram', signups: 1, depositors: 1 },
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
    // SET LOCAL + 2 window queries = 3 calls
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'cohort_stats_snapshot' },
      update: expect.objectContaining({ value: expect.any(String) }),
    }));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Stale snapshot detected'));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Self-healed stale snapshot'));
  });

  it('serves stale fallback and alerts WatchTower when self-heal fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('database timeout'));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe('2026-07-08T01:01:48.043Z');
    expect(log.error).toHaveBeenCalledWith('Cohort Stats', 'Live recompute failed: database timeout');
    expect(log.error).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Serving stale snapshot'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('writer computes with statement timeout and stores the snapshot', async () => {
    const response = await GET(request('cron'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
    expect(prisma.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'cohort_stats_snapshot' },
    }));
    expect(log.info).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Snapshot written'));
  });

  it('returns 401 with no-cache headers for unauthorized requests', async () => {
    const response = await GET(request('bad-token'));
    expect(response.status).toBe(401);
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store');
  });

  it('rejects analytics and cron credentials supplied through the query string', async () => {
    for (const token of ['analytics', 'cron']) {
      const response = await GET(new Request(`http://localhost/api/cron/cohort-stats?token=${token}`));
      expect(response.status).toBe(401);
    }
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
