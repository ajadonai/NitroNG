import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processMetaCapiOutbox: vi.fn(),
  reportOperationalFailure: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ default: { name: 'mock-db' } }));
vi.mock('@/lib/meta-capi', () => ({
  processMetaCapiOutbox: (...args) => mocks.processMetaCapiOutbox(...args),
}));
vi.mock('@/lib/monitoring', () => ({
  reportOperationalFailure: (...args) => mocks.reportOperationalFailure(...args),
}));
vi.mock('@/lib/logger', () => ({
  log: { error: (...args) => mocks.logError(...args) },
}));

const { GET } = await import('@/app/api/cron/meta-capi/route.js');
const originalSecret = process.env.CRON_SECRET;

function request(secret) {
  return { headers: new Headers(secret ? { authorization: `Bearer ${secret}` } : {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'cron-secret';
  mocks.processMetaCapiOutbox.mockResolvedValue({
    checked: 2,
    sent: 1,
    retried: 1,
    skipped: 0,
    health: { status: 'healthy', expected: 20, sent: 20, ratio: 1 },
  });
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe('Meta CAPI recovery cron', () => {
  it('fails closed when cron auth is absent or wrong', async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request('cron-secret'))).status).toBe(503);
    process.env.CRON_SECRET = 'cron-secret';
    expect((await GET(request('wrong'))).status).toBe(401);
    expect(mocks.processMetaCapiOutbox).not.toHaveBeenCalled();
  });

  it('processes durable retries and returns the health result', async () => {
    const response = await GET(request('cron-secret'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ checked: 2, sent: 1, retried: 1 });
    expect(mocks.processMetaCapiOutbox).toHaveBeenCalledWith({ db: { name: 'mock-db' } });
  });

  it('reports a loud operational failure if recovery crashes', async () => {
    mocks.processMetaCapiOutbox.mockRejectedValue(new Error('database unavailable'));
    const response = await GET(request('cron-secret'));
    expect(response.status).toBe(500);
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith('meta_capi_recovery_failed', {
      error: expect.any(Error),
      data: { job: 'meta_capi_cron' },
      dedupeKey: 'meta_capi_recovery_failed',
    });
  });
});
