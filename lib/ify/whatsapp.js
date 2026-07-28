// lib/ify/whatsapp.js
// WhatsApp Cloud API: verify inbound webhooks + send outbound (free-text replies AND templates).
// No SDK — plain fetch, to keep dependencies lean.
//
// IMPORTANT: free-text (sendText) only works INSIDE the 24h customer-service window (i.e. as a
// reply after the user messaged you). Business-INITIATED messages (outreach) must use sendTemplate
// with a pre-approved template.

import crypto from 'crypto';
import { IFY } from './config';
import { log } from '@/lib/logger';

// Verify Meta's X-Hub-Signature-256: HMAC-SHA256(rawBody, appSecret). Use the RAW body.
export function verifySignature(rawBody, signatureHeader) {
  if (!IFY.wa.appSecret || !signatureHeader) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', IFY.wa.appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const endpoint = () =>
  `https://graph.facebook.com/${IFY.wa.graphVersion}/${IFY.wa.phoneNumberId}/messages`;

async function post(payload) {
  if (!IFY.wa.token || !IFY.wa.phoneNumberId) {
    log.warn('Ify', 'WhatsApp not configured — skipping send');
    return false;
  }
  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${IFY.wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.warn('Ify', `WA send failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    log.error('Ify', `WA send error: ${e.message}`);
    return false;
  }
}

// Free-text reply (only valid within an open 24h service window).
export async function sendText(to, body) {
  return post({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: String(body || '').slice(0, 4096), preview_url: false },
  });
}

// Business-initiated template message.
// bodyParams: ordered strings filling {{1}},{{2}}… in the template's BODY.
export async function sendTemplate(to, templateName, langCode = 'en', bodyParams = []) {
  const components = bodyParams.length
    ? [{ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t ?? '') })) }]
    : [];
  return post({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: { name: templateName, language: { code: langCode }, components },
  });
}

// Mark an inbound message as read (blue ticks). Best-effort.
export async function markRead(messageId) {
  if (!IFY.wa.token || !messageId) return;
  try {
    await fetch(endpoint(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${IFY.wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
    });
  } catch {
    /* best-effort */
  }
}
