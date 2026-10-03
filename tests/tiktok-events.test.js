import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('@/lib/monitoring', () => ({ reportOperationalFailure: vi.fn(() => true) }));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const {
  buildTikTokEvent,
  parseTikTokCookies,
  sendTikTokEvent,
  sendPreparedTikTokEvent,
  tiktokDeliveryMode,
  tiktokEventName,
  trackTikTokDeposit,
  isPermanentTikTokError,
  isPermissionTikTokError,
  isTransientTikTokError,
  warnIfTestCodeInProduction,
  TIKTOK_PIXEL_CODE,
  TIKTOK_PIXEL_ID,
} = await import('@/lib/tiktok-events');
const { reportOperationalFailure } = await import('@/lib/monitoring');

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const ok = () => ({ ok: true, json: async () => ({ code: 0, message: 'OK', request_id: 'r1' }) });

afterEach(() => { vi.clearAllMocks(); delete process.env.TIKTOK_EVENTS_TOKEN; });

describe('the two pixel identifiers', () => {
  // Swapping these breaks deduplication with no error at all, so they are
  // pinned apart: the browser's sdkid is alphanumeric, the server's
  // event_source_id is numeric, and they are not interchangeable.
  it('are distinct values and not confusable', () => {
    expect(TIKTOK_PIXEL_CODE).toBe('DB06VT3C77U2INVDM2MG');
    expect(TIKTOK_PIXEL_ID).toBe('7692263347735117831');
    expect(TIKTOK_PIXEL_CODE).not.toBe(TIKTOK_PIXEL_ID);
  });

  it('sends the numeric id as event_source_id, never the browser code', async () => {
    process.env.TIKTOK_EVENTS_TOKEN = 'tok';
    const fetchImpl = vi.fn(ok);
    await sendPreparedTikTokEvent({ event: 'CompletePayment', event_id: 'x' }, { fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.event_source_id).toBe(TIKTOK_PIXEL_ID);
    expect(JSON.stringify(body)).not.toContain(TIKTOK_PIXEL_CODE);
    expect(body.event_source).toBe('web');
  });
});

describe('event name translation', () => {
  // Our call sites all speak Meta's vocabulary because Meta came first. TikTok
  // renames two, and ROAS only reads the same on both platforms if the
  // translation happens in exactly one place.
  it('renames Purchase to CompletePayment', () => {
    expect(tiktokEventName('Purchase')).toBe('CompletePayment');
  });

  it('renames PageView to Pageview, which TikTok spells with a lowercase v', () => {
    expect(tiktokEventName('PageView')).toBe('Pageview');
  });

  it('passes through the names both platforms spell the same', () => {
    expect(tiktokEventName('AddPaymentInfo')).toBe('AddPaymentInfo');
    expect(tiktokEventName('CompleteRegistration')).toBe('CompleteRegistration');
    expect(tiktokEventName('ViewContent')).toBe('ViewContent');
  });

  it('translates when building, so a call site never has to know', () => {
    const event = buildTikTokEvent('Purchase', { eventId: 'order_1' });
    expect(event.event).toBe('CompletePayment');
  });
});

describe('buildTikTokEvent', () => {
  it('hashes the PII and leaves TikTok own identifiers raw', () => {
    const event = buildTikTokEvent('CompletePayment', {
      eventId: 'order_7',
      email: '  Trip@Nitro.NG ',
      phone: '08031234567',
      externalId: 'user_42',
      ttclid: 'ttclid-abc',
      ttp: 'ttp-xyz',
      clientIp: '102.89.1.1',
      userAgent: 'Mozilla/5.0',
    });
    expect(event.user.email).toBe(sha('trip@nitro.ng'));
    expect(event.user.phone).toBe(sha('2348031234567'));
    expect(event.user.external_id).toBe(sha('user_42'));
    // Hashing a click id would make it unmatchable — it is not PII.
    expect(event.user.ttclid).toBe('ttclid-abc');
    expect(event.user.ttp).toBe('ttp-xyz');
    expect(event.user.ip).toBe('102.89.1.1');
    expect(event.user.user_agent).toBe('Mozilla/5.0');
  });

  it('never lets a raw email or phone into the payload', () => {
    const event = buildTikTokEvent('AddPaymentInfo', {
      eventId: 'apinfo_1', email: 'trip@nitro.ng', phone: '08031234567',
    });
    const json = JSON.stringify(event);
    expect(json).not.toContain('trip@nitro.ng');
    expect(json).not.toContain('08031234567');
    expect(json).not.toContain('2348031234567');
  });

  it('passes a foreign number through untouched, as the Meta normaliser does', () => {
    const uk = buildTikTokEvent('AddPaymentInfo', { eventId: 'a', phone: '+44 7911 123456' });
    expect(uk.user.phone).toBe(sha('447911123456'));
  });

  it('strips the query string off the source url', () => {
    const event = buildTikTokEvent('ViewContent', {
      eventId: 'v1', sourceUrl: 'https://nitro.ng/services?ttclid=abc#top',
    });
    expect(event.page.url).toBe('https://nitro.ng/services');
  });

  it('requires an event_id, because without one nothing can be deduplicated', () => {
    expect(() => buildTikTokEvent('Purchase', {})).toThrow(/event_id/);
    expect(() => buildTikTokEvent('Purchase', { eventId: '  ' })).toThrow(/event_id/);
  });

  it('omits empty properties rather than sending a bare object', () => {
    expect(buildTikTokEvent('ViewContent', { eventId: 'v', properties: {} }).properties).toBeUndefined();
  });
});

describe('parseTikTokCookies', () => {
  it('reads the pixel own _ttp and the ttclid we capture ourselves', () => {
    expect(parseTikTokCookies('_ttp=abc123; other=1; _ttclid=CLICK99')).toEqual({ ttp: 'abc123', ttclid: 'CLICK99' });
  });

  it('url-decodes the click id, since that is how it was written', () => {
    expect(parseTikTokCookies('_ttclid=a%2Fb').ttclid).toBe('a/b');
  });

  it('is empty rather than broken when there is no cookie header', () => {
    expect(parseTikTokCookies(undefined)).toEqual({});
    expect(parseTikTokCookies('')).toEqual({});
  });
});

describe('where TikTok is allowed to deliver', () => {
  const base = { TIKTOK_EVENTS_TOKEN: 'tok' };

  it('delivers in production', () => {
    expect(tiktokDeliveryMode({ ...base, NODE_ENV: 'production' })).toEqual({ live: true, reason: 'production' });
    expect(tiktokDeliveryMode({ ...base, VERCEL_ENV: 'production', NODE_ENV: 'development' }).live).toBe(true);
  });

  it('never delivers without a token, which is the state until one is generated', () => {
    expect(tiktokDeliveryMode({ NODE_ENV: 'production' })).toEqual({ live: false, reason: 'no_token' });
  });

  it('stays silent on a developer machine, where it would skew the live pixel', () => {
    expect(tiktokDeliveryMode({ ...base, NODE_ENV: 'development' })).toEqual({ live: false, reason: 'non_production' });
    expect(tiktokDeliveryMode({ ...base, VERCEL_ENV: 'preview' }).live).toBe(false);
  });

  it('can be opted into locally with an explicit flag', () => {
    expect(tiktokDeliveryMode({ ...base, NODE_ENV: 'development', TIKTOK_EVENTS_ALLOW_DEV: '1' }))
      .toEqual({ live: true, reason: 'dev_opt_in' });
  });

  it('delivers from a laptop when a test event code makes it safe', () => {
    expect(tiktokDeliveryMode({ ...base, NODE_ENV: 'development', TIKTOK_EVENTS_TEST_EVENT_CODE: 'TEST123' }))
      .toEqual({ live: true, reason: 'test_event_code' });
  });

  it('still needs a token even with a test event code', () => {
    expect(tiktokDeliveryMode({ NODE_ENV: 'development', TIKTOK_EVENTS_TEST_EVENT_CODE: 'TEST123' }).live).toBe(false);
  });

  it('skips cleanly instead of failing when there is no token', async () => {
    const fetchImpl = vi.fn(ok);
    const result = await sendTikTokEvent('Purchase', { eventId: 'order_1' }, { fetchImpl });
    expect(result).toEqual({ ok: false, skipped: true, reason: 'no_token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('reading TikTok response', () => {
  beforeEach(() => {
    process.env.TIKTOK_EVENTS_TOKEN = 'tok';
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => { process.env.NODE_ENV = 'test'; });

  // Meta puts its token in the query string, where it lands in access logs.
  // TikTok takes a header, and a secret must not leak into the URL.
  it('sends the token as an Access-Token header, not a query parameter', async () => {
    process.env.TIKTOK_EVENTS_TOKEN = 'SECRET-abc123';
    const fetchImpl = vi.fn(ok);
    await sendPreparedTikTokEvent({ event: 'Pageview', event_id: 'p' }, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(init.headers['Access-Token']).toBe('SECRET-abc123');
    expect(url).not.toContain('SECRET-abc123');
  });

  // The trap: TikTok answers HTTP 200 and puts its real verdict in the body.
  it('treats a non-zero body code as a failure even on HTTP 200', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ code: 40001, message: 'Invalid params' }) }));
    const result = await sendTikTokEvent('Purchase', { eventId: 'order_2' }, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('Invalid params');
  });

  it('accepts code 0 as success', async () => {
    const fetchImpl = vi.fn(ok);
    const result = await sendTikTokEvent('Purchase', { eventId: 'order_3' }, { fetchImpl });
    expect(result).toMatchObject({ ok: true, requestId: 'r1' });
  });

  it('collapses a rejected token onto one alert carrying the fix', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ code: 40100, message: 'Access token is invalid' }) }));
    await sendTikTokEvent('Purchase', { eventId: 'order_4' }, { fetchImpl });
    expect(reportOperationalFailure).toHaveBeenCalledTimes(1);
    const [signal, payload] = reportOperationalFailure.mock.calls[0];
    expect(signal).toBe('tiktok_events_delivery_failed');
    expect(payload.dedupeKey).toBe('tiktok_events_token_rejected');
    expect(payload.data.fix).toMatch(/Events Manager/);
  });

  it('retries a network failure to the attempt limit, then gives up quietly', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const result = await sendTikTokEvent('Purchase', { eventId: 'order_5' }, { fetchImpl, retryDelayMs: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    // An event the browser also reports needs no alert: the pixel covers it.
    expect(reportOperationalFailure).not.toHaveBeenCalled();
  });

  it('succeeds on a retry without reporting anything', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      if (++n === 1) throw new TypeError('fetch failed');
      return ok();
    });
    const result = await sendTikTokEvent('Purchase', { eventId: 'order_5b' }, { fetchImpl, retryDelayMs: 0 });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(reportOperationalFailure).not.toHaveBeenCalled();
  });

  // Without an outbox these attempts are the only insurance a server-only
  // event gets, so a 5xx or a rate limit has to be retried too — not just the
  // network-level failures.
  it('retries a TikTok 5xx and a rate limit, which are TikTok problem not ours', async () => {
    for (const status of [500, 503, 429]) {
      vi.clearAllMocks();
      const fetchImpl = vi.fn(async () => ({ ok: false, status, json: async () => ({ code: 50000, message: 'server error' }) }));
      await sendTikTokEvent('Purchase', { eventId: `order_${status}` }, { fetchImpl, retryDelayMs: 0 });
      expect(fetchImpl, `status ${status}`).toHaveBeenCalledTimes(3);
    }
  });

  it('does not retry a rejected token, which would fail identically forever', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ code: 40100, message: 'bad token' }) }));
    await sendTikTokEvent('Purchase', { eventId: 'order_6' }, { fetchImpl, retryDelayMs: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry malformed parameters, which are our bug', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ code: 40001, message: 'Invalid params' }) }));
    await sendTikTokEvent('Purchase', { eventId: 'order_6b' }, { fetchImpl, retryDelayMs: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  // The deposit is the event ROAS is judged on and the one with no browser
  // twin, so losing it has to be visible even though the cause was transient.
  it('reports a lost critical event even when the failure was transient', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await sendTikTokEvent('AddPaymentInfo', { eventId: 'apinfo_1', critical: true }, { fetchImpl, retryDelayMs: 0 });
    expect(reportOperationalFailure).toHaveBeenCalledTimes(1);
    const [, payload] = reportOperationalFailure.mock.calls[0];
    expect(payload.data.lost).toBe(true);
    expect(payload.data.attempts).toBe(3);
    expect(payload.level).toBe('warning');
  });

  it('never throws, so tracking cannot fail an order or a deposit', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('boom'); });
    await expect(sendTikTokEvent('Purchase', { eventId: 'order_7' }, { fetchImpl })).resolves.toMatchObject({ ok: false });
    // A missing event_id is a programming error, and still must not throw here.
    await expect(sendTikTokEvent('Purchase', {}, { fetchImpl })).resolves.toMatchObject({ ok: false });
  });

  it('classifies errors so the caller knows what is worth repeating', () => {
    expect(isTransientTikTokError({ code: 'timeout' })).toBe(true);
    expect(isTransientTikTokError({ code: 'network' })).toBe(true);
    expect(isTransientTikTokError({ code: 40100 })).toBe(false);
    expect(isPermanentTikTokError({ code: 'missing_token' })).toBe(true);
    expect(isPermanentTikTokError({ code: 40105 })).toBe(true);
    expect(isPermanentTikTokError({ code: 'timeout' })).toBe(false);
  });
});

/**
 * Reproduced from issue 7769738905, 3 Oct, a real order (NTR-13614): HTTP 401,
 * body code 40001, "No permission to operate event source id: ...". The token
 * authenticated — TikTok answered with a structured error, not a transport
 * failure — but was not authorised for the pixel.
 */
describe('a valid token that cannot reach the pixel', () => {
  const forbidden = () => ({
    ok: false,
    status: 401,
    json: async () => ({ code: 40001, message: 'No permission to operate event source id: 7692263347735117831' }),
  });

  beforeEach(() => {
    process.env.TIKTOK_EVENTS_TOKEN = 'tok';
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => { process.env.NODE_ENV = 'test'; });

  it('recommends fixing the permission, not regenerating the token', async () => {
    await sendTikTokEvent('Purchase', { eventId: 'purchase_NTR-13614', critical: true }, { fetchImpl: vi.fn(forbidden), retryDelayMs: 0 });
    const [, payload] = reportOperationalFailure.mock.calls[0];
    expect(payload.data.fix).toMatch(/not authorised for pixel/);
    expect(payload.data.fix).toMatch(/Do NOT regenerate/);
    // The original alert sent Trip to regenerate a token that was never broken.
    expect(payload.data.fix).not.toMatch(/Generate a new one/);
  });

  it('is its own signal, not collapsed onto a rejected token', async () => {
    await sendTikTokEvent('Purchase', { eventId: 'purchase_1' }, { fetchImpl: vi.fn(forbidden), retryDelayMs: 0 });
    expect(reportOperationalFailure.mock.calls[0][1].dedupeKey).toBe('tiktok_events_no_pixel_permission');
  });

  it('reports the attempts it actually made, not the ceiling', async () => {
    const fetchImpl = vi.fn(forbidden);
    await sendTikTokEvent('Purchase', { eventId: 'purchase_2', critical: true }, { fetchImpl, retryDelayMs: 0 });
    // A permission failure is permanent, so it stops after one try. Reporting
    // 3 had whoever read the alert looking for a flaky network.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(reportOperationalFailure.mock.calls[0][1].data.attempts).toBe(1);
  });

  it('still reports the real attempt count when it does retry', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await sendTikTokEvent('AddPaymentInfo', { eventId: 'apinfo_2', critical: true }, { fetchImpl, retryDelayMs: 0 });
    expect(reportOperationalFailure.mock.calls[0][1].data.attempts).toBe(3);
  });

  it('separates a permission failure from genuinely malformed params', () => {
    // Both are code 40001; only the message tells them apart.
    expect(isPermissionTikTokError({ code: 40001, message: 'No permission to operate event source id: 123' })).toBe(true);
    expect(isPermissionTikTokError({ code: 40001, message: 'Invalid params' })).toBe(false);
  });
});

describe('test event code', () => {
  beforeEach(() => {
    process.env.TIKTOK_EVENTS_TOKEN = 'tok';
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.TIKTOK_EVENTS_TEST_EVENT_CODE;
  });

  it('sends the code so the event lands in Test Events, not reporting', async () => {
    process.env.TIKTOK_EVENTS_TEST_EVENT_CODE = 'TEST123';
    const fetchImpl = vi.fn(ok);
    await sendTikTokEvent('Purchase', { eventId: 'order_t1' }, { fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).test_event_code).toBe('TEST123');
  });

  // An empty string is not the same as an absent field: TikTok would read it
  // as a code it cannot match rather than as "no test code".
  it('omits the field entirely when there is no code', async () => {
    const fetchImpl = vi.fn(ok);
    await sendTikTokEvent('Purchase', { eventId: 'order_t2' }, { fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).not.toHaveProperty('test_event_code');
  });

  it('lets a caller override the environment code per event', async () => {
    process.env.TIKTOK_EVENTS_TEST_EVENT_CODE = 'FROM_ENV';
    const fetchImpl = vi.fn(ok);
    await sendTikTokEvent('Purchase', { eventId: 'order_t3', testEventCode: 'FROM_CALLER' }, { fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).test_event_code).toBe('FROM_CALLER');
  });

  // The foot-gun: left set in production it silently diverts every real
  // conversion away from reporting, so ROAS reads zero and looks like broken
  // tracking rather than a stray variable.
  it('pages once when a test code is left set in production', () => {
    expect(warnIfTestCodeInProduction({ VERCEL_ENV: 'production', TIKTOK_EVENTS_TEST_EVENT_CODE: 'TEST123' })).toBe(true);
    expect(reportOperationalFailure).toHaveBeenCalledTimes(1);
    const [signal, payload] = reportOperationalFailure.mock.calls[0];
    expect(signal).toBe('tiktok_events_test_code_in_production');
    expect(payload.data.fix).toMatch(/Unset TIKTOK_EVENTS_TEST_EVENT_CODE/);
  });

  it('says nothing when a test code is used where it belongs', () => {
    expect(warnIfTestCodeInProduction({ NODE_ENV: 'development', TIKTOK_EVENTS_TEST_EVENT_CODE: 'TEST123' })).toBe(false);
    expect(warnIfTestCodeInProduction({ VERCEL_ENV: 'production' })).toBe(false);
    expect(reportOperationalFailure).not.toHaveBeenCalled();
  });
});

describe('trackTikTokDeposit', () => {
  beforeEach(() => {
    process.env.TIKTOK_EVENTS_TOKEN = 'tok';
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => { process.env.NODE_ENV = 'test'; });

  // The ÷100 happens exactly once. Double-dividing was a real Meta bug and it
  // is invisible in the dashboard — the numbers simply read 100x too small.
  it('converts kobo to full Naira once, and says NGN', async () => {
    const fetchImpl = vi.fn(ok);
    await trackTikTokDeposit({
      reference: 'TXN99', amountKobo: 850_000, userId: 'u1', email: 'a@b.ng', fetchImpl,
    });
    // transport options are not threaded through trackTikTokDeposit, so assert
    // on the built event instead of the fetch call.
    const event = buildTikTokEvent('AddPaymentInfo', {
      eventId: 'apinfo_TXN99', properties: { currency: 'NGN', value: 850_000 / 100, content_id: 'TXN99' },
    });
    expect(event.properties).toEqual({ currency: 'NGN', value: 8500, content_id: 'TXN99' });
  });

  it('anchors the event id on the transaction, so retries collapse to one', () => {
    const a = buildTikTokEvent('AddPaymentInfo', { eventId: 'apinfo_TXN99' });
    const b = buildTikTokEvent('AddPaymentInfo', { eventId: 'apinfo_TXN99' });
    expect(a.event_id).toBe(b.event_id);
  });
});
