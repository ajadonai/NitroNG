// app/api/ify/webhook/route.js
// WhatsApp Cloud API webhook for Ify.
//   GET  → Meta verification handshake (returns hub.challenge)
//   POST → inbound messages (verifies signature, then hands off to the orchestrator)

import { IFY } from '@/lib/ify/config';
import { verifySignature } from '@/lib/ify/whatsapp';
import { handleInbound } from '@/lib/ify/handle';
import { log } from '@/lib/logger';

export const runtime = 'nodejs'; // HMAC verification needs the Node runtime (not Edge)

// ── Verification handshake ──────────────────────────────────────────────
export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === IFY.wa.verifyToken) {
    return new Response(challenge || '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ── Inbound messages ────────────────────────────────────────────────────
export async function POST(req) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    log.warn('Ify', 'Invalid webhook signature — rejected');
    return new Response('Invalid signature', { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        for (const msg of value.messages || []) {
          if (msg.type !== 'text') continue; // v1: text only
          const from = msg.from;
          const text = msg.text?.body || '';
          const messageId = msg.id;
          const name = contacts.find((c) => c.wa_id === from)?.profile?.name || null;
          await handleInbound({ from, text, name, messageId });
        }
      }
    }
  } catch (e) {
    log.error('Ify', `webhook processing error: ${e.message}`);
    // fall through to 200 so Meta doesn't storm retries — the error is logged
  }

  return new Response('OK', { status: 200 });
}
