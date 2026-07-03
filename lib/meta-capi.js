import crypto from 'crypto';
import { log } from '@/lib/logger';

const PIXEL_ID = '27456534517306114';
const API_VERSION = 'v21.0';

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function generateEventId() {
  return crypto.randomUUID();
}

/**
 * Send a server-side event to Meta Conversions API.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * @param {string} eventName - 'Purchase' | 'CompleteRegistration' | 'AddPaymentInfo'
 * @param {object} opts
 * @param {string} opts.eventId - must match the browser pixel eventID for dedup
 * @param {string} [opts.email] - unhashed, will be SHA-256'd
 * @param {string} [opts.phone] - unhashed, will be SHA-256'd
 * @param {string} [opts.clientIp]
 * @param {string} [opts.userAgent]
 * @param {string} [opts.fbp] - _fbp cookie value
 * @param {string} [opts.fbc] - _fbc cookie value
 * @param {string} [opts.sourceUrl] - page URL where event occurred
 * @param {object} [opts.customData] - { value, currency } for Purchase
 */
export async function sendEvent(eventName, opts = {}) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) { log.warn('MetaCAPI', `${eventName}: META_CAPI_TOKEN not set`); return; }

  const userData = {};
  if (opts.email) userData.em = [sha256(opts.email)];
  if (opts.phone) userData.ph = [sha256(opts.phone)];
  if (opts.externalId) userData.external_id = [sha256(opts.externalId)];
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;
  if (opts.fbp) userData.fbp = opts.fbp;
  if (opts.fbc) userData.fbc = opts.fbc;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: opts.eventId,
    action_source: 'website',
    user_data: userData,
  };
  if (opts.sourceUrl) event.event_source_url = opts.sourceUrl;
  if (opts.customData) event.custom_data = opts.customData;

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${token}`;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 3000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    const r = await res.json();
    if (r.error) log.warn('MetaCAPI', `${eventName}: ${r.error.message}`);
  } catch (err) {
    log.warn('MetaCAPI', `${eventName}: ${err.message}`);
  }
}

/**
 * Single entry point for deposit tracking — call wherever a Transaction
 * flips to status='Completed'. Uses deterministic event_id so browser
 * pixel + every server path deduplicate in Meta.
 */
export async function trackDeposit({ email, userId, reference, amountKobo, clientIp, userAgent, fbp, fbc, sourceUrl }) {
  await sendEvent('AddPaymentInfo', {
    eventId: `apinfo_${reference}`,
    email,
    externalId: userId,
    clientIp,
    userAgent,
    fbp,
    fbc,
    sourceUrl,
    customData: { value: amountKobo / 100, currency: 'NGN' },
  });
}

/**
 * Extract _fbp and _fbc from a cookie header string.
 */
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
