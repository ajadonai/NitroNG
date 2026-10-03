import crypto from 'crypto';
import { log } from '@/lib/logger';
import { reportOperationalFailure } from '@/lib/monitoring';
import { redactSensitiveText } from '@/lib/monitoring-redaction';
import { contentIdFromEventId, tiktokProperties } from '@/lib/tiktok-properties';

/**
 * TikTok's Events API — the server half of the pixel, deduplicated against the
 * browser half by a shared event_id. Deliberately the *simple* half of what
 * lib/meta-capi.js does: direct send with one retry, no durable outbox.
 *
 * Meta earned its outbox (a table, leases, five-step backoff, 7-day expiry, a
 * health check reconciling sent Purchases against paid Orders) after it was
 * already carrying real volume. TikTok has had no spend at all yet, so paying
 * that complexity up front would be guessing at a problem we have no evidence
 * of. If Events Manager shows us losing events, the outbox is the fix and this
 * module is the thing to grow — not a reason to have built it twice.
 */

// One identifier for both halves — see lib/tiktok-pixel.js for why the spec's
// separate numeric "Pixel ID" is not usable as event_source_id.
import { TIKTOK_PIXEL_CODE } from '@/lib/tiktok-pixel';
export { TIKTOK_PIXEL_CODE };

const ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const TIKTOK_TIMEOUT_MS = 10_000;

/**
 * Our event vocabulary is Meta's, because Meta came first and every call site
 * already speaks it. TikTok renames two of them, so ROAS reads the same way on
 * both platforms only if the translation happens in exactly one place: here.
 *
 * Pageview is mapped for completeness but never sent server-side — ttq.page()
 * accepts no event_id, so a server twin could never be matched against it and
 * would simply double every page view.
 */
export const TIKTOK_EVENT_NAMES = {
  PageView: 'Pageview',
  ViewContent: 'ViewContent',
  CompleteRegistration: 'CompleteRegistration',
  AddPaymentInfo: 'AddPaymentInfo',
  Purchase: 'CompletePayment',
};

export function tiktokEventName(metaEventName) {
  return TIKTOK_EVENT_NAMES[metaEventName] || metaEventName;
}

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

// Same normaliser as the Meta build, and for the same reason: a number that
// already carries a foreign country code passes through untouched, and only the
// two genuinely ambiguous local shapes get 234 prepended.
function normalizePhone(raw) {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `234${digits}`;
  return digits;
}

function eventTimeSeconds(value) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric > 10_000_000_000 ? numeric / 1000 : numeric);
  }
  return Math.floor(Date.now() / 1000);
}

function sanitizeSourceUrl(value) {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().split(/[?#]/, 1)[0];
  return clean || undefined;
}

function safeFailureMessage(error) {
  const value = error instanceof Error ? error.message : String(error || 'Unknown TikTok Events failure');
  return redactSensitiveText(value).slice(0, 500);
}

/**
 * ttclid is TikTok's click id, and _ttp its first-party browser id — the exact
 * analogues of fbclid/_fbp. The pixel writes _ttp itself; ttclid is captured
 * into a cookie of our own on landing, the way ensureFbcFromClick does for _fbc.
 *
 * Reading both off the request cookie header covers every event fired inside a
 * request the user's browser made. It does NOT cover events raised from a
 * payment webhook, where there is no browser and no cookies — Meta needed
 * User.lastFbp/lastFbc for precisely that gap. The equivalent columns here are
 * deliberately not added yet: they cost a migration, and until a TikTok
 * campaign is actually running there is no attribution for them to carry.
 */
export function parseTikTokCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const result = {};
  for (const pair of String(cookieHeader).split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === '_ttp') result.ttp = rest.join('=');
    if (key === '_ttclid') result.ttclid = decodeURIComponent(rest.join('='));
  }
  return result;
}

export function buildTikTokEvent(metaEventName, opts = {}) {
  if (typeof metaEventName !== 'string' || !metaEventName.trim()) {
    throw new Error('TikTok event name is required');
  }
  if (typeof opts.eventId !== 'string' || !opts.eventId.trim()) {
    throw new Error('TikTok event_id is required');
  }

  const user = {};
  if (opts.email) user.email = sha256(opts.email);
  if (opts.phone) user.phone = sha256(normalizePhone(opts.phone));
  if (opts.externalId) user.external_id = sha256(opts.externalId);
  // Click and browser ids are sent raw — they are TikTok's own identifiers,
  // not PII, and hashing them would make them unmatchable.
  if (opts.ttclid) user.ttclid = opts.ttclid;
  if (opts.ttp) user.ttp = opts.ttp;
  if (opts.clientIp) user.ip = opts.clientIp;
  if (opts.userAgent) user.user_agent = opts.userAgent;

  const event = {
    event: tiktokEventName(metaEventName),
    event_time: eventTimeSeconds(opts.eventTime),
    event_id: opts.eventId,
    user,
  };
  const sourceUrl = sanitizeSourceUrl(opts.sourceUrl);
  if (sourceUrl) event.page = { url: sourceUrl };
  if (opts.properties && Object.keys(opts.properties).length) event.properties = opts.properties;
  return event;
}

export class TikTokDeliveryError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'TikTokDeliveryError';
    this.status = status;
    this.code = code;
  }
}

const NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);
function isNetworkFailure(error) {
  if (!error) return false;
  if (NETWORK_CODES.has(error?.cause?.code) || NETWORK_CODES.has(error?.code)) return true;
  return error instanceof TypeError && /fetch failed/i.test(error.message || '');
}

export function isTransientTikTokError(error) {
  return error?.code === 'timeout' || error?.code === 'network';
}

/**
 * Worth sending again. Broader than "transient" on purpose: a server-only
 * event — a deposit confirmed by a payment webhook — has no browser twin to
 * cover for it, so a dropped send is gone for good. Without an outbox, these
 * attempts are the only insurance it gets.
 *
 * Retry anything that is TikTok's problem (unreachable, timed out, 5xx, rate
 * limited) and nothing that is ours: a rejected token and malformed parameters
 * fail identically however many times they are sent.
 */
export function isRetryableTikTokError(error) {
  if (!error) return false;
  if (isPermanentTikTokError(error)) return false;
  if (isTransientTikTokError(error)) return true;
  const status = Number(error.status);
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * TikTok answers HTTP 200 with its real verdict in the body's `code` field, so
 * response.ok proves nothing on its own. 40100/40101/40105 are the auth codes:
 * a rejected token fails identically for every event until a human replaces
 * it, so retrying is pointless and one alert naming the fix is the remedy.
 */
const TIKTOK_AUTH_CODES = new Set([40100, 40101, 40105]);

/**
 * A valid token that is not authorised for this pixel. TikTok reports it as
 * code 40001 with "No permission to operate event source id: <id>" — the same
 * code it uses for malformed parameters, so the message is the only thing that
 * separates them, and both arrive as HTTP 401.
 *
 * Worth its own class because the remedy is the opposite of a bad token's:
 * regenerating the token changes nothing when the problem is which assets it
 * can reach. Seen live on 3 Oct against a real order (NTR-13614), where the
 * alert confidently recommended generating a new token.
 */
export function isPermissionTikTokError(error) {
  return /no permission to operate|not authoriz|not authoris/i.test(error?.message || '');
}

export function isPermanentTikTokError(error) {
  if (!error) return false;
  if (error.code === 'missing_token') return true;
  if (TIKTOK_AUTH_CODES.has(Number(error.code))) return true;
  return /access.?token|permission|unauthor/i.test(error.message || '');
}

export const TIKTOK_PERMISSION_FIX = `The Events API token is valid but is not authorised for pixel ${TIKTOK_PIXEL_CODE}. Do NOT regenerate it — that changes nothing if the grant is the problem. Check the token was issued from THIS pixel's own Events API setup in Events Manager: a token generated against a different pixel fails exactly like this, which is what happened on 3 Oct. Business Center 7653119772225470471, ad account 7652987696486596609.`;

export const TIKTOK_TOKEN_FIX = 'TikTok rejected the Events API token. Generate a new one in Events Manager (pixel → Settings → Events API) and set TIKTOK_EVENTS_TOKEN in Vercel Production, then redeploy — the token silently no-ops without a Production redeploy.';

/**
 * Whether TikTok should actually be called from this process. Same gate as
 * Meta's, and for the same two reasons: a developer's laptop should not raise
 * an alert every time a stale token is rejected, and — worse if the token were
 * valid — development traffic must never land on the live pixel and skew
 * attribution.
 */
export function tiktokDeliveryMode(env = process.env) {
  if (!env.TIKTOK_EVENTS_TOKEN) return { live: false, reason: 'no_token' };
  const isProd = (env.VERCEL_ENV || env.NODE_ENV) === 'production';
  if (isProd) return { live: true, reason: 'production' };
  // A test event code is TikTok's own sandbox: events land in the Test Events
  // tab instead of reporting, so delivering from a laptop is safe and is the
  // whole point of setting one.
  if (env.TIKTOK_EVENTS_TEST_EVENT_CODE) return { live: true, reason: 'test_event_code' };
  if (env.TIKTOK_EVENTS_ALLOW_DEV === '1') return { live: true, reason: 'dev_opt_in' };
  return { live: false, reason: 'non_production' };
}

/**
 * The foot-gun this mirrors from Meta: a test event code left set in
 * production diverts EVERY real conversion into the Test Events tab, where it
 * never reaches reporting or optimisation. Nothing fails, the events are
 * accepted, and ROAS simply reads zero — which looks like broken tracking
 * rather than a stray environment variable. Loud, and paged once a day.
 */
export function warnIfTestCodeInProduction(env = process.env, monitor = reportOperationalFailure) {
  const isProd = (env.VERCEL_ENV || env.NODE_ENV) === 'production';
  if (!isProd || !env.TIKTOK_EVENTS_TEST_EVENT_CODE) return false;
  log.warn('TikTokEvents', 'TIKTOK_EVENTS_TEST_EVENT_CODE is set in production — every conversion is being diverted to Test Events and will not reach reporting. Unset it and redeploy.');
  monitor('tiktok_events_test_code_in_production', {
    data: { fix: 'Unset TIKTOK_EVENTS_TEST_EVENT_CODE in Vercel Production and redeploy. Until then no TikTok conversion reaches reporting or optimisation.' },
    dedupeKey: 'tiktok_events_test_code_in_production',
    throttleMs: 24 * 60 * 60 * 1000,
  });
  return true;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function sendPreparedTikTokEvent(event, {
  testEventCode,
  fetchImpl = globalThis.fetch,
  timeoutMs = TIKTOK_TIMEOUT_MS,
} = {}) {
  const token = process.env.TIKTOK_EVENTS_TOKEN;
  if (!token) throw new TikTokDeliveryError('TIKTOK_EVENTS_TOKEN not set', { code: 'missing_token' });
  if (typeof fetchImpl !== 'function') throw new TikTokDeliveryError('TikTok fetch is unavailable', { code: 'missing_fetch' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    event_source: 'web',
    event_source_id: TIKTOK_PIXEL_CODE,
    data: [event],
  };
  // Routes the event to the Test Events tab instead of reporting. Omitted
  // entirely when absent — sending an empty string is not the same as not
  // sending the field, and TikTok treats it as a code it cannot match.
  if (testEventCode) body.test_event_code = testEventCode;
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new TikTokDeliveryError(`TikTok returned invalid JSON (HTTP ${response.status})`, {
        status: response.status,
        code: 'invalid_json',
      });
    }
    // The body's code is authoritative; 0 is success and HTTP 200 alone is not.
    if (!response.ok || Number(result?.code) !== 0) {
      throw new TikTokDeliveryError(
        result?.message || `TikTok returned HTTP ${response.status}`,
        { status: response.status, code: result?.code ?? 'tiktok_error' },
      );
    }
    return { ok: true, requestId: result?.request_id };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new TikTokDeliveryError(`TikTok timed out after ${timeoutMs}ms`, { code: 'timeout' });
    }
    if (isNetworkFailure(error)) {
      throw new TikTokDeliveryError(`TikTok unreachable (${error?.cause?.code || error?.message || 'fetch failed'})`, { code: 'network' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send one event. Never throws: TikTok tracking must not be able to fail a
 * signup, an order or a deposit. Callers that need to know get it in the
 * return value.
 */
export async function sendTikTokEvent(metaEventName, opts = {}, transportOptions = {}) {
  const mode = tiktokDeliveryMode();
  if (!mode.live) {
    log.debug?.('TikTokEvents', `${metaEventName} not sent (${mode.reason})`);
    return { ok: false, skipped: true, reason: mode.reason };
  }

  let event;
  try {
    event = buildTikTokEvent(metaEventName, opts);
  } catch (error) {
    log.error('TikTokEvents', `${metaEventName} could not be built: ${safeFailureMessage(error)}`);
    return { ok: false, error };
  }

  warnIfTestCodeInProduction();
  const transport = {
    testEventCode: opts.testEventCode || process.env.TIKTOK_EVENTS_TEST_EVENT_CODE,
    ...transportOptions,
  };
  const retryDelayMs = transportOptions.retryDelayMs ?? 400;
  // Three attempts, backing off. There is no outbox behind this, so for a
  // server-only event these are the only chances it gets; two extra tries cost
  // nothing on the happy path and recover a TikTok blip or a rate limit.
  const maxAttempts = transportOptions.maxAttempts ?? 3;
  let error;
  // The real count, not the ceiling: a permanent failure stops after one, and
  // an alert claiming three sends whoever reads it looking for a flaky network.
  let attemptsMade = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptsMade = attempt;
    try {
      const result = await sendPreparedTikTokEvent(event, transport);
      log.info('TikTokEvents', `${event.event} sent (${opts.eventId})`, { attempt });
      return result;
    } catch (err) {
      error = err;
      if (attempt < maxAttempts && isRetryableTikTokError(err)) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
      break;
    }
  }

  const message = safeFailureMessage(error);
  const transient = isTransientTikTokError(error);
  const permanent = isPermanentTikTokError(error);
  const permission = isPermissionTikTokError(error);
  log[transient ? 'warn' : 'error']('TikTokEvents', `${event.event} delivery failed (${opts.eventId}): ${message}`);
  // A transient failure on an event the browser also reports is the retry's
  // business and nobody else's. But `critical` marks an event with no browser
  // twin — a deposit confirmed by a payment webhook — and once its attempts
  // are spent there is no outbox holding it, so the conversion is simply lost.
  // That is worth a signal whatever the cause.
  if (!transient || opts.critical) {
    reportOperationalFailure('tiktok_events_delivery_failed', {
      error,
      data: {
        eventName: event.event,
        code: error?.code || 'unknown',
        attempts: attemptsMade,
        ...(opts.critical ? { lost: true, note: 'server-only event, no browser twin and no outbox' } : {}),
        // Permission is checked first: it shares code 40001 and the word
        // "permission" with the token regex, so testing permanent first would
        // keep recommending a pointless token regeneration.
        ...(permission ? { fix: TIKTOK_PERMISSION_FIX } : permanent ? { fix: TIKTOK_TOKEN_FIX } : {}),
      },
      // One configuration problem is one signal, not one per event name — and
      // a token that cannot reach the pixel is a different problem from a
      // token TikTok rejects, so they do not collapse onto each other.
      dedupeKey: permission
        ? 'tiktok_events_no_pixel_permission'
        : permanent
          ? 'tiktok_events_token_rejected'
          : `tiktok_events_delivery_failed:${event.event.toLowerCase()}`,
      level: transient ? 'warning' : 'error',
    });
  }
  return { ok: false, error };
}

/**
 * Fire-and-forget wrapper for call sites inside a business transaction, where
 * tracking must never extend or fail the real work.
 */
export function trackTikTokEvent(metaEventName, opts = {}) {
  void sendTikTokEvent(metaEventName, opts).catch(() => {});
}

/**
 * Translate a prepared Meta CAPI opts object into TikTok's shape. The order
 * routes build one of these for Meta already, carrying the identity and the
 * value in full Naira; rebuilding it independently for TikTok is how the two
 * platforms drift apart and stop reconciling. One translation, one place.
 *
 * `critical` defaults true because every call site is a server-only event —
 * the browser never fires a purchase on this site.
 */
export function tiktokOptsFromMeta(metaOpts = {}, { ttclid, ttp, critical = true } = {}) {
  return {
    eventId: metaOpts.eventId,
    eventTime: metaOpts.eventTime,
    email: metaOpts.email,
    phone: metaOpts.phone,
    externalId: metaOpts.externalId,
    clientIp: metaOpts.clientIp,
    userAgent: metaOpts.userAgent,
    sourceUrl: metaOpts.sourceUrl,
    ttclid,
    ttp,
    // Meta calls it custom_data, TikTok calls it properties, and the two do
    // not agree on content_type or on content_id being required. The value in
    // full Naira and the NGN currency carry over untouched; the content fields
    // are translated, with the order or batch id recovered from the event id.
    properties: tiktokProperties(metaOpts.customData, {
      fallbackId: contentIdFromEventId(metaOpts.eventId),
    }),
    critical,
  };
}

/**
 * Deposits are the real money on the wallet model — orders are tiny and
 * dripped — so this is the event TikTok ROAS is judged on. Value is full
 * Naira: the ÷100 from kobo happens here, once, exactly as in the Meta build.
 */
export async function trackTikTokDeposit({ email, phone, userId, reference, amountKobo, clientIp, userAgent, ttclid, ttp, sourceUrl }) {
  return sendTikTokEvent('AddPaymentInfo', {
    eventId: `apinfo_${reference}`,
    email,
    phone,
    externalId: userId,
    clientIp,
    userAgent,
    ttclid,
    ttp,
    sourceUrl,
    // No browser twin: a deposit is confirmed by a payment webhook, where
    // there is no browser to fire a pixel. If this is lost, it is lost.
    critical: true,
    // content_type is required alongside content_id or TikTok flags the pair.
    // A top-up is one thing, so "product" rather than "product_group".
    properties: {
      currency: 'NGN',
      value: amountKobo / 100,
      content_id: String(reference),
      content_type: 'product',
    },
  });
}
