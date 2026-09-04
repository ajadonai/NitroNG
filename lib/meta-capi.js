import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { reportOperationalFailure } from '@/lib/monitoring';
import { redactSensitiveText } from '@/lib/monitoring-redaction';

function keepAlive(promise) {
  try {
    waitUntil(promise);
  } catch {
    void promise.catch(() => {});
  }
}

const PIXEL_ID = '27456534517306114';
const API_VERSION = 'v21.0';
const META_TIMEOUT_MS = 10_000;
const META_LEASE_MS = 30_000;
const HEALTH_STATE_KEY = 'meta_capi_purchase_health';
const PURCHASE_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;
const PURCHASE_HEALTH_GRACE_MS = 15 * 60 * 1000;
const PURCHASE_HEALTH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PURCHASE_HEALTH_THRESHOLD = 0.9;
const META_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

// Nigerian mobile prefixes after the leading zero are 70/71/80/81/90/91. A UK
// local 07911 lands on "79" — outside that set — so a prefix table COULD catch
// some diaspora numbers typed in local format. Deliberately not done: prefix
// tables drift and rot silently, and the diaspora-local-format segment is
// near-zero. Revisit only if diaspora orders become a real slice. Numbers that
// already carry a foreign country code pass through untouched (tested).
function normalizePhone(raw) {
  if (!raw) return undefined;
  let digits = raw.replace(/\D/g, '');
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

function safeFailureMessage(error) {
  const value = error instanceof Error ? error.message : String(error || 'Unknown Meta CAPI failure');
  return redactSensitiveText(value).slice(0, 500);
}

function retryDelay(attempts) {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)];
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function sanitizeSourceUrl(value) {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().split(/[?#]/, 1)[0];
  return clean || undefined;
}

function expirableWhere(now, extra = {}) {
  return {
    ...extra,
    sentAt: null,
    createdAt: { lte: new Date(now.getTime() - META_EVENT_RETENTION_MS) },
    OR: [
      { status: { in: ['pending', 'failed'] } },
      { status: 'sending', leaseExpiresAt: { lt: now } },
    ],
  };
}

function expiredEventData() {
  return {
    status: 'expired',
    payload: {},
    leaseToken: null,
    leaseExpiresAt: null,
    lastError: 'delivery_window_expired_after_7_days',
  };
}

function reportExpiredMetaEvents(count, monitor = reportOperationalFailure) {
  if (count < 1) return;
  log.error('MetaCAPI', `Expired ${count} undelivered event${count === 1 ? '' : 's'} after 7 days`);
  monitor('meta_capi_events_expired', {
    data: { count, maxAgeDays: 7 },
    dedupeKey: 'meta_capi_events_expired',
    throttleMs: PURCHASE_HEALTH_COOLDOWN_MS,
  });
}

/**
 * The identity AddPaymentInfo has always used and Purchase never did: the DB
 * phone (the session JWT carries none) and the fb click/browser ids persisted
 * at payment time. Purchase call sites load this and fall back to it.
 */
export async function loadStoredCapiIdentity(db, userId) {
  if (!userId) return {};
  try {
    return await db.user.findUnique({ where: { id: userId }, select: { phone: true, lastFbp: true, lastFbc: true } }) || {};
  } catch { return {}; }
}

/** Keep lastFbp/lastFbc fresh whenever a request carries the cookies. */
export async function persistFbTouch(db, userId, { fbp, fbc } = {}, stored = {}) {
  const data = {};
  if (fbp && fbp !== stored.lastFbp) data.lastFbp = fbp;
  if (fbc && fbc !== stored.lastFbc) data.lastFbc = fbc;
  if (!userId || Object.keys(data).length === 0) return;
  try { await db.user.update({ where: { id: userId }, data }); } catch {}
}

export function generateEventId() {
  return crypto.randomUUID();
}

export function buildMetaEvent(eventName, opts = {}) {
  if (typeof eventName !== 'string' || !eventName.trim()) throw new Error('Meta CAPI event name is required');
  if (typeof opts.eventId !== 'string' || !opts.eventId.trim()) throw new Error('Meta CAPI event_id is required');

  const userData = {};
  if (opts.email) userData.em = [sha256(opts.email)];
  if (opts.phone) userData.ph = [sha256(normalizePhone(opts.phone))];
  if (opts.externalId) userData.external_id = [sha256(opts.externalId)];
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;
  if (opts.fbp) userData.fbp = opts.fbp;
  if (opts.fbc) userData.fbc = opts.fbc;

  const event = {
    event_name: eventName,
    event_time: eventTimeSeconds(opts.eventTime),
    event_id: opts.eventId,
    action_source: 'website',
    user_data: userData,
  };
  const sourceUrl = sanitizeSourceUrl(opts.sourceUrl);
  if (sourceUrl) event.event_source_url = sourceUrl;
  if (opts.customData) event.custom_data = opts.customData;
  return event;
}

export class MetaCapiDeliveryError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'MetaCapiDeliveryError';
    this.status = status;
    this.code = code;
  }
}

/** Strict transport for a fully prepared event. It throws on every non-delivery. */
export async function sendPreparedMetaEvent(event, {
  testEventCode,
  fetchImpl = globalThis.fetch,
  timeoutMs = META_TIMEOUT_MS,
} = {}) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) throw new MetaCapiDeliveryError('META_CAPI_TOKEN not set', { code: 'missing_token' });
  if (typeof fetchImpl !== 'function') throw new MetaCapiDeliveryError('Meta CAPI fetch is unavailable', { code: 'missing_fetch' });

  const body = { data: [event] };
  if (testEventCode) body.test_event_code = testEventCode;
  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new MetaCapiDeliveryError(`Meta CAPI returned invalid JSON (HTTP ${response.status})`, {
        status: response.status,
        code: 'invalid_json',
      });
    }

    if (!response.ok || result?.error) {
      throw new MetaCapiDeliveryError(
        result?.error?.message || `Meta CAPI returned HTTP ${response.status}`,
        { status: response.status, code: result?.error?.code || 'graph_error' },
      );
    }
    if (!Number.isFinite(Number(result?.events_received)) || Number(result.events_received) < 1) {
      throw new MetaCapiDeliveryError('Meta CAPI acknowledged zero events', { code: 'zero_events_received' });
    }
    return { ok: true, eventsReceived: Number(result.events_received), traceId: result.fbtrace_id };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new MetaCapiDeliveryError(`Meta CAPI timed out after ${timeoutMs}ms`, { code: 'timeout' });
    }
    if (isNetworkFailure(error)) {
      throw new MetaCapiDeliveryError(`Meta CAPI unreachable (${error?.cause?.code || error?.message || 'fetch failed'})`, { code: 'network' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// undici surfaces DNS, TLS and socket failures as TypeError('fetch failed')
// with the real code on `cause`. They are Meta's weather, not our bug.
const NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);
function isNetworkFailure(error) {
  if (!error) return false;
  if (NETWORK_CODES.has(error?.cause?.code) || NETWORK_CODES.has(error?.code)) return true;
  return error instanceof TypeError && /fetch failed/i.test(error.message || '');
}
/** Timeouts and network failures: worth a retry, not worth a page. */
export function isTransientMetaError(error) {
  return error?.code === 'timeout' || error?.code === 'network';
}

// Meta's auth and permission codes. A rejected token fails identically for
// every event until a human replaces it, so retrying is pointless and paging
// once per event is noise — one alert naming the fix is the whole remedy.
// 190 invalid token · 102 session expired · 10 and 200 permission denied · 2500 malformed OAuth
const META_AUTH_CODES = new Set([190, 102, 10, 200, 2500]);
export function isPermanentMetaError(error) {
  if (!error) return false;
  if (error.code === 'missing_token') return true;
  if (META_AUTH_CODES.has(Number(error.code))) return true;
  return /access token|oauth|permission|expired/i.test(error.message || '');
}

/**
 * Whether Meta CAPI should actually be called from this process.
 *
 * Two things were happening on a developer's laptop: every tracked event tried
 * to deliver with whatever token was in .env.local and raised an alert when
 * Meta rejected it, and — worse if the token had been valid — development
 * traffic would have landed on the live pixel and skewed ad attribution.
 * Delivery is therefore off outside production unless it is asked for, either
 * with a test event code (Meta's own sandbox) or an explicit opt-in.
 */
export const META_TOKEN_FIX = 'Meta rejected the CAPI token. Issue a new system-user token in Events Manager and set META_CAPI_TOKEN; queued events resend on their own once it is valid.';

export function metaCapiDeliveryMode(env = process.env) {
  if (!env.META_CAPI_TOKEN) return { live: false, reason: 'no_token' };
  const isProd = (env.VERCEL_ENV || env.NODE_ENV) === 'production';
  if (isProd) return { live: true, reason: 'production' };
  if (env.META_CAPI_TEST_EVENT_CODE) return { live: true, reason: 'test_event_code' };
  if (env.META_CAPI_ALLOW_DEV === '1') return { live: true, reason: 'dev_opt_in' };
  return { live: false, reason: 'non_production' };
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Direct delivery for non-durable events. It is strict about Meta's response,
 * reports failures loudly, and returns a structured result to legacy callers.
 */
export async function sendEvent(eventName, opts = {}, transportOptions = {}) {
  const mode = metaCapiDeliveryMode();
  if (!mode.live) {
    log.debug?.('MetaCAPI', `${eventName} not sent (${mode.reason})`);
    return { ok: false, skipped: true, reason: mode.reason };
  }
  const event = buildMetaEvent(eventName, opts);
  const transport = { testEventCode: opts.testEventCode || process.env.META_CAPI_TEST_EVENT_CODE, ...transportOptions };
  const retryDelayMs = transportOptions.retryDelayMs ?? 400;
  let error;
  // One retry on a timeout or a network failure: Meta's edge drops a request
  // now and then, and the second one almost always lands.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await sendPreparedMetaEvent(event, transport);
      log.info('MetaCAPI', `${eventName} sent (${opts.eventId})`, { eventsReceived: result.eventsReceived, attempt });
      return result;
    } catch (err) {
      error = err;
      if (attempt === 1 && isTransientMetaError(err)) { await sleep(retryDelayMs); continue; }
      break;
    }
  }
  const message = safeFailureMessage(error);
  const transient = isTransientMetaError(error);
  const permanent = isPermanentMetaError(error);
  log[transient ? 'warn' : 'error']('MetaCAPI', `${eventName} delivery failed (${opts.eventId}): ${message}`);
  // Transient failures on this non-durable path are logged, not paged: the
  // retry above is the remedy, and there is nothing for a person to do.
  if (!transient) {
    reportOperationalFailure('meta_capi_delivery_failed', {
      error,
      data: { eventName, code: error?.code || 'unknown', ...(permanent ? { fix: META_TOKEN_FIX } : {}) },
      // A rejected token is one problem, not one per event name: collapse it
      // onto a single signal so it is fixed once rather than muted many times.
      dedupeKey: permanent ? 'meta_capi_token_rejected' : `meta_capi_delivery_failed:${eventName.toLowerCase()}`,
    });
  }
  return { ok: false, error };
}

/**
 * Atomically enqueue an event alongside the business transaction. An existing
 * deterministic eventId is left untouched so its event_time and payload cannot
 * drift across retries.
 */
export async function enqueueMetaEvent(db, eventName, opts = {}) {
  // Nothing is queued when delivery is off: a developer's laptop should not be
  // filling the outbox with events it can never send.
  const mode = metaCapiDeliveryMode();
  if (!mode.live) {
    log.debug?.('MetaCAPI', `${eventName} not queued (${mode.reason})`);
    return null;
  }
  if (!db?.metaCapiEvent?.upsert) throw new Error('Meta CAPI outbox is unavailable');
  const payload = buildMetaEvent(eventName, opts);
  const expectedPayloadHash = payloadHash(payload);
  const nextAttemptAt = opts.notBefore ? new Date(opts.notBefore) : new Date();
  if (Number.isNaN(nextAttemptAt.getTime())) throw new Error('Meta CAPI notBefore is invalid');
  const event = await db.metaCapiEvent.upsert({
    where: { eventId: opts.eventId },
    // Prisma requires an update branch; assigning the unique key to itself is
    // a no-op and preserves the original immutable payload.
    update: { eventId: opts.eventId },
    create: {
      eventId: opts.eventId,
      eventName,
      payload,
      payloadHash: expectedPayloadHash,
      testEventCode: opts.testEventCode || process.env.META_CAPI_TEST_EVENT_CODE || null,
      status: 'pending',
      nextAttemptAt,
    },
  });
  if (event.eventName !== eventName || event.payloadHash !== expectedPayloadHash) {
    throw new Error('Meta CAPI event_id collision');
  }
  return event;
}

/** Cancel an unsent event in the same transaction that unwinds its order. */
export async function cancelQueuedMetaEvent(db, eventId, reason = 'Business operation cancelled') {
  if (!db?.metaCapiEvent?.updateMany) throw new Error('Meta CAPI outbox is unavailable');
  const result = await db.metaCapiEvent.updateMany({
    where: { eventId, sentAt: null, status: { not: 'cancelled' } },
    data: {
      status: 'cancelled',
      leaseToken: null,
      leaseExpiresAt: null,
      payload: {},
      lastError: safeFailureMessage(reason),
    },
  });
  return { cancelled: result.count === 1 };
}

async function claimQueuedMetaEvent(db, eventId, now, monitor) {
  const current = await db.metaCapiEvent.findUnique({ where: { eventId } });
  if (!current) return { status: 'missing' };
  if (current.sentAt || current.status === 'sent') return { status: 'sent', event: current };
  if (current.status === 'cancelled' || current.status === 'expired') return { status: current.status };

  if (current.createdAt && current.createdAt <= new Date(now.getTime() - META_EVENT_RETENTION_MS)) {
    const expired = await db.metaCapiEvent.updateMany({
      where: expirableWhere(now, { id: current.id }),
      data: expiredEventData(),
    });
    if (expired.count === 1) {
      reportExpiredMetaEvents(1, monitor);
      return { status: 'expired' };
    }
  }

  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + META_LEASE_MS);
  const claimed = await db.metaCapiEvent.updateMany({
    where: {
      id: current.id,
      sentAt: null,
      OR: [
        { status: { in: ['pending', 'failed'] }, nextAttemptAt: { lte: now } },
        { status: 'sending', leaseExpiresAt: { lt: now } },
      ],
    },
    data: { status: 'sending', leaseToken, leaseExpiresAt, lastAttemptAt: now },
  });
  if (claimed.count !== 1) return { status: 'busy' };
  return { status: 'claimed', event: current, leaseToken };
}

/** Deliver one queued event. Failed attempts are always fenced and rescheduled. */
export async function deliverQueuedMetaEvent(eventId, {
  db = prisma,
  fetchImpl = globalThis.fetch,
  now: nowInput = new Date(),
  timeoutMs = META_TIMEOUT_MS,
  monitor = reportOperationalFailure,
} = {}) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const claim = await claimQueuedMetaEvent(db, eventId, now, monitor);
  if (claim.status === 'missing') return { ok: false, status: 'missing' };
  if (claim.status === 'sent') return { ok: true, status: 'already_sent' };
  if (claim.status !== 'claimed') return { ok: false, status: claim.status };

  try {
    const result = await sendPreparedMetaEvent(claim.event.payload, {
      testEventCode: claim.event.testEventCode || undefined,
      fetchImpl,
      timeoutMs,
    });
    const updated = await db.metaCapiEvent.updateMany({
      where: { id: claim.event.id, status: 'sending', leaseToken: claim.leaseToken, sentAt: null },
      data: {
        status: 'sent',
        sentAt: now,
        attempts: { increment: 1 },
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: null,
        payload: {},
      },
    });
    if (updated.count !== 1) return { ok: false, status: 'lease_lost' };
    log.info('MetaCAPI', `${claim.event.eventName} sent (${eventId})`, { eventsReceived: result.eventsReceived });
    return { ok: true, status: 'sent', eventsReceived: result.eventsReceived };
  } catch (error) {
    const attempts = claim.event.attempts + 1;
    const message = safeFailureMessage(error);
    const nextAttemptAt = new Date(now.getTime() + retryDelay(attempts));
    const updated = await db.metaCapiEvent.updateMany({
      where: { id: claim.event.id, status: 'sending', leaseToken: claim.leaseToken, sentAt: null },
      data: {
        status: 'failed',
        attempts: { increment: 1 },
        nextAttemptAt,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: message,
        ...(claim.event.firstError == null ? { firstError: message } : {}),
      },
    });
    const transient = isTransientMetaError(error);
    const permanent = isPermanentMetaError(error);
    log[transient ? 'warn' : 'error']('MetaCAPI', `${claim.event.eventName} delivery failed (${eventId}): ${message}`, {
      retryAt: nextAttemptAt.toISOString(),
    });
    // The outbox retries with backoff, so a transient failure only pages once
    // it has happened three times to the same event. A rejected token is a
    // single configuration problem: it collapses onto one signal carrying the
    // fix, instead of one alert per event name every time the cron runs.
    if (!transient || attempts >= 3) {
      reportOperationalFailure('meta_capi_delivery_failed', {
        error,
        data: {
          eventName: claim.event.eventName,
          attempt: attempts,
          retryScheduled: updated.count === 1,
          ...(permanent ? { fix: META_TOKEN_FIX } : {}),
        },
        dedupeKey: permanent ? 'meta_capi_token_rejected' : `meta_capi_delivery_failed:${claim.event.eventName.toLowerCase()}`,
        level: transient ? 'warning' : 'error',
      });
    }
    return { ok: false, status: updated.count === 1 ? 'retry_scheduled' : 'lease_lost', nextAttemptAt };
  }
}

/**
 * Makes a deferred event eligible after its business operation succeeds, then
 * attempts immediate delivery. The durable cron remains authoritative if a
 * serverless runtime freezes before this task finishes.
 */
export function scheduleQueuedMetaEventDelivery(eventId, options = {}) {
  const db = options.db || prisma;
  const nowInput = options.now || new Date();
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const work = Promise.resolve().then(() => db.metaCapiEvent.updateMany({
    where: { eventId, sentAt: null, status: { in: ['pending', 'failed'] } },
    data: { nextAttemptAt: now },
  })).then(() => deliverQueuedMetaEvent(eventId, { ...options, db, now })).catch(error => {
    log.error('MetaCAPI', `Immediate outbox delivery crashed (${eventId}): ${safeFailureMessage(error)}`);
    reportOperationalFailure('meta_capi_delivery_failed', {
      error,
      data: { phase: 'immediate_delivery' },
      dedupeKey: 'meta_capi_delivery_failed:immediate',
    });
  });
  keepAlive(work);
}

function parseHealthState(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Uses paid Orders as the independent expected source, then measures both
 * enqueue coverage and delivery success for their deterministic Purchase IDs.
 */
export async function checkMetaPurchaseHealth({
  db = prisma,
  now: nowInput = new Date(),
  monitor = reportOperationalFailure,
} = {}) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const windowEnd = new Date(now.getTime() - PURCHASE_HEALTH_GRACE_MS);
  const windowStart = new Date(windowEnd.getTime() - PURCHASE_HEALTH_WINDOW_MS);
  const [orders, oldest, stored] = await Promise.all([
    db.order.findMany({
      where: { charge: { gt: 0 }, createdAt: { gte: windowStart, lte: windowEnd } },
      select: { orderId: true, batchId: true },
    }),
    db.metaCapiEvent.findFirst({
      where: { eventName: 'Purchase' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    db.setting.findUnique({ where: { key: HEALTH_STATE_KEY } }),
  ]);
  const expectedEventIds = [...new Set(orders.map(order => `purchase_${order.batchId || order.orderId}`))];
  const outboxRows = expectedEventIds.length > 0
    ? await db.metaCapiEvent.findMany({
      where: { eventName: 'Purchase', eventId: { in: expectedEventIds } },
      select: { eventId: true, status: true, sentAt: true },
    })
    : [];
  const expected = expectedEventIds.length;
  const expectedIdSet = new Set(expectedEventIds);
  const matchingRows = outboxRows.filter(row => expectedIdSet.has(row.eventId));
  const enqueued = new Set(matchingRows.map(row => row.eventId)).size;
  const deliverableRows = matchingRows.filter(row => row.status !== 'cancelled');
  const deliveryExpected = new Set(deliverableRows.map(row => row.eventId)).size;
  const sent = new Set(deliverableRows.filter(row => row.sentAt).map(row => row.eventId)).size;
  const enqueueCoverageRatio = expected > 0 ? enqueued / expected : 1;
  const deliveryRatio = deliveryExpected > 0 ? sent / deliveryExpected : 1;
  const previous = parseHealthState(stored?.value);
  const monitoringSince = previous.monitoringSince || oldest?.createdAt?.toISOString() || now.toISOString();
  const mature = new Date(monitoringSince) <= windowStart;
  const unhealthy = mature
    && (enqueueCoverageRatio < PURCHASE_HEALTH_THRESHOLD || deliveryRatio < PURCHASE_HEALTH_THRESHOLD);
  const lastAlertAt = previous.lastAlertAt ? new Date(previous.lastAlertAt) : null;
  const cooldownElapsed = !lastAlertAt || Number.isNaN(lastAlertAt.getTime())
    || now.getTime() - lastAlertAt.getTime() >= PURCHASE_HEALTH_COOLDOWN_MS;

  let alerted = false;
  if (unhealthy && cooldownElapsed) {
    alerted = monitor('meta_capi_purchase_volume_low', {
      data: {
        expected,
        enqueued,
        deliveryExpected,
        sent,
        enqueueCoverageRatio: Number(enqueueCoverageRatio.toFixed(4)),
        deliveryRatio: Number(deliveryRatio.toFixed(4)),
        windowHours: 24,
      },
      dedupeKey: 'meta_capi_purchase_volume_low',
      throttleMs: PURCHASE_HEALTH_COOLDOWN_MS,
    }) !== false;
  }

  const state = {
    status: unhealthy ? 'unhealthy' : mature ? 'healthy' : 'warming_up',
    checkedAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    monitoringSince,
    expected,
    enqueued,
    deliveryExpected,
    sent,
    enqueueCoverageRatio,
    deliveryRatio,
    lastAlertAt: alerted ? now.toISOString() : previous.lastAlertAt || null,
  };
  await db.setting.upsert({
    where: { key: HEALTH_STATE_KEY },
    update: { value: JSON.stringify(state) },
    create: { key: HEALTH_STATE_KEY, value: JSON.stringify(state) },
  });
  return { ...state, alerted };
}

export async function processMetaCapiOutbox({
  db = prisma,
  fetchImpl = globalThis.fetch,
  now: nowInput = new Date(),
  limit = 20,
  monitor = reportOperationalFailure,
} = {}) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const expired = await db.metaCapiEvent.updateMany({
    where: expirableWhere(now),
    data: expiredEventData(),
  });
  reportExpiredMetaEvents(expired.count, monitor);
  const due = await db.metaCapiEvent.findMany({
    where: {
      sentAt: null,
      OR: [
        { status: { in: ['pending', 'failed'] }, nextAttemptAt: { lte: now } },
        { status: 'sending', leaseExpiresAt: { lt: now } },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    select: { eventId: true },
    take: Math.min(Math.max(Number(limit) || 20, 1), 50),
  });

  const stats = { checked: due.length, sent: 0, retried: 0, skipped: 0, expired: expired.count };
  const concurrency = 5;
  for (let index = 0; index < due.length; index += concurrency) {
    const results = await Promise.all(
      due.slice(index, index + concurrency)
        .map(row => deliverQueuedMetaEvent(row.eventId, { db, fetchImpl, now, monitor })),
    );
    for (const result of results) {
      if (result.ok && result.status === 'sent') stats.sent += 1;
      else if (result.status === 'retry_scheduled') stats.retried += 1;
      else stats.skipped += 1;
    }
  }
  const health = await checkMetaPurchaseHealth({ db, now, monitor });
  return { ...stats, health };
}

/**
 * Single entry point for deposit tracking — call wherever a Transaction flips
 * to status='Completed'. The deterministic event_id deduplicates repeated calls.
 */
export async function trackDeposit({ email, phone, userId, reference, amountKobo, clientIp, userAgent, fbp, fbc, sourceUrl }) {
  const result = await sendEvent('AddPaymentInfo', {
    eventId: `apinfo_${reference}`,
    email,
    phone,
    externalId: userId,
    clientIp,
    userAgent,
    fbp,
    fbc,
    sourceUrl,
    customData: { value: amountKobo / 100, currency: 'NGN' },
  });
  if (!result.ok) throw result.error;
  return result;
}

export function parseFbCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const result = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === '_fbp') result.fbp = rest.join('=');
    if (key === '_fbc') result.fbc = rest.join('=');
  }
  return result;
}
