import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/monitoring', () => ({ reportOperationalFailure: vi.fn(() => true) }));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { metaCapiDeliveryMode, isPermanentMetaError, sendEvent, enqueueMetaEvent } = await import('@/lib/meta-capi');
const { reportOperationalFailure } = await import('@/lib/monitoring');

const base = { META_CAPI_TOKEN: 'tok' };

afterEach(() => vi.clearAllMocks());

describe('where Meta CAPI is allowed to deliver', () => {
  it('delivers in production', () => {
    expect(metaCapiDeliveryMode({ ...base, NODE_ENV: 'production' })).toEqual({ live: true, reason: 'production' });
    expect(metaCapiDeliveryMode({ ...base, VERCEL_ENV: 'production', NODE_ENV: 'development' }).live).toBe(true);
  });

  it('stays silent on a developer machine, where it would both fail and skew the live pixel', () => {
    expect(metaCapiDeliveryMode({ ...base, NODE_ENV: 'development' })).toEqual({ live: false, reason: 'non_production' });
    expect(metaCapiDeliveryMode({ ...base, VERCEL_ENV: 'preview' }).live).toBe(false);
  });

  it('never delivers without a token', () => {
    expect(metaCapiDeliveryMode({ NODE_ENV: 'production' })).toEqual({ live: false, reason: 'no_token' });
  });

  it('can be opted into for local testing, by test event code or explicit flag', () => {
    expect(metaCapiDeliveryMode({ ...base, NODE_ENV: 'development', META_CAPI_TEST_EVENT_CODE: 'TEST123' }).live).toBe(true);
    expect(metaCapiDeliveryMode({ ...base, NODE_ENV: 'development', META_CAPI_ALLOW_DEV: '1' }).live).toBe(true);
  });
});

describe('a rejected token', () => {
  it('is recognised however Meta words it', () => {
    expect(isPermanentMetaError({ code: 190 })).toBe(true);
    expect(isPermanentMetaError({ code: 'missing_token' })).toBe(true);
    expect(isPermanentMetaError({ message: 'Invalid OAuth access token - Cannot parse access token' })).toBe(true);
    // The Sentry issue that prompted this: a graph_error code carrying an auth message.
    expect(isPermanentMetaError({ code: 'graph_error', message: 'Invalid OAuth access token - Cannot parse access token' })).toBe(true);
  });

  it('is not confused with the failures that deserve a retry', () => {
    expect(isPermanentMetaError({ code: 'timeout', message: 'Meta CAPI timed out after 4000ms' })).toBe(false);
    expect(isPermanentMetaError({ code: 'network', message: 'Meta CAPI unreachable (ECONNRESET)' })).toBe(false);
    expect(isPermanentMetaError(null)).toBe(false);
  });
});

describe('the noise that prompted this', () => {
  it('sends nothing and raises nothing from development', async () => {
    const prev = { node: process.env.NODE_ENV, tok: process.env.META_CAPI_TOKEN, dev: process.env.META_CAPI_ALLOW_DEV };
    process.env.META_CAPI_TOKEN = 'expired-token';
    delete process.env.META_CAPI_ALLOW_DEV;
    const fetchImpl = vi.fn();
    try {
      const result = await sendEvent('PageView', { eventId: 'e1' }, { fetchImpl });
      expect(result).toEqual({ ok: false, skipped: true, reason: 'non_production' });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(reportOperationalFailure).not.toHaveBeenCalled();
      // Nor does it fill the outbox with events it can never deliver.
      const upsert = vi.fn();
      await expect(enqueueMetaEvent({ metaCapiEvent: { upsert } }, 'Purchase', { eventId: 'e2' })).resolves.toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    } finally {
      if (prev.tok === undefined) delete process.env.META_CAPI_TOKEN; else process.env.META_CAPI_TOKEN = prev.tok;
      if (prev.dev === undefined) delete process.env.META_CAPI_ALLOW_DEV; else process.env.META_CAPI_ALLOW_DEV = prev.dev;
      process.env.NODE_ENV = prev.node;
    }
  });

  it('collapses a rejected token onto one signal instead of one per event name', async () => {
    const prev = process.env.META_CAPI_ALLOW_DEV;
    process.env.META_CAPI_TOKEN = 'expired-token';
    process.env.META_CAPI_ALLOW_DEV = '1';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token - Cannot parse access token', code: 190 } }),
    });
    try {
      await sendEvent('PageView', { eventId: 'a' }, { fetchImpl });
      await sendEvent('Purchase', { eventId: 'b' }, { fetchImpl });
      const keys = reportOperationalFailure.mock.calls.map(([, opts]) => opts.dedupeKey);
      expect(new Set(keys)).toEqual(new Set(['meta_capi_token_rejected']));
      // and the alert says what to actually do about it
      expect(reportOperationalFailure.mock.calls[0][1].data.fix).toMatch(/Events Manager/);
      // a token error is never retried — it fails identically every time
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      if (prev === undefined) delete process.env.META_CAPI_ALLOW_DEV; else process.env.META_CAPI_ALLOW_DEV = prev;
    }
  });
});
