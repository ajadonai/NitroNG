import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = {
  $queryRaw: vi.fn(),
  setting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  adminIssue: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log }));

const { GET } = await import('@/app/api/cron/cohort-stats/route');

function request(token = 'analytics') {
  return new Request(`http://localhost/api/cron/cohort-stats?token=${token}`);
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
  prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify(snapshot()) });
  prisma.setting.upsert.mockResolvedValue({});
  prisma.adminIssue.findFirst.mockResolvedValue(null);
  prisma.adminIssue.create.mockResolvedValue({});
  prisma.adminIssue.update.mockResolvedValue({});
  prisma.$queryRaw.mockResolvedValue(statsRow());
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
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'cohort_stats_snapshot' },
      update: expect.objectContaining({ value: expect.any(String) }),
    }));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Stale snapshot detected'));
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Self-healed stale snapshot'));
  });

  it('serves stale fallback and opens a monitoring issue when self-heal fails past 26h', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database timeout'));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe('2026-07-08T01:01:48.043Z');
    expect(log.error).toHaveBeenCalledWith('Cohort Stats', 'Live recompute failed: database timeout');
    expect(log.warn).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Serving stale snapshot'));
    expect(prisma.adminIssue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'cohort_stats_stale',
        title: expect.stringContaining('Cohort stats snapshot stale'),
        message: expect.stringContaining('database timeout'),
      }),
    }));
  });

  it('writer uses the same optimized compute path and stores the snapshot', async () => {
    const response = await GET(request('cron'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'cohort_stats_snapshot' },
    }));
    expect(log.info).toHaveBeenCalledWith('Cohort Stats', expect.stringContaining('Snapshot written'));
  });
});
