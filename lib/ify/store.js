// lib/ify/store.js
// Conversation memory, de-duplication, AI/human handoff state, per-session turn counting,
// non-user metering, and durable logging. Redis (Upstash) for hot state; Postgres for the log.

import { Redis } from '@upstash/redis';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { IFY } from './config';

let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  /* Redis optional; features degrade gracefully without it */
}

const K = {
  mem: (p) => `ify:mem:${p}`,
  seen: (id) => `ify:seen:${id}`,
  mode: (p) => `ify:mode:${p}`,   // 'human' while a person is handling the chat
  turns: (p) => `ify:turns:${p}`, // AI reply count in the current session
  nonuser: (p) => `ify:nu:${p}`,
};

// De-dupe WhatsApp message ids (Meta re-delivers on any non-200). Returns true if NEW.
export async function markSeen(messageId) {
  if (!redis || !messageId) return true;
  try {
    return (await redis.set(K.seen(messageId), '1', { nx: true, ex: 60 * 60 * 24 })) === 'OK';
  } catch {
    return true;
  }
}

// Short rolling memory: array of { role:'user'|'assistant', content }.
export async function getMemory(phone) {
  if (!redis) return [];
  try {
    return (await redis.get(K.mem(phone))) || [];
  } catch {
    return [];
  }
}

export async function pushMemory(phone, userMsg, botMsg) {
  if (!redis) return;
  try {
    const mem = (await redis.get(K.mem(phone))) || [];
    if (userMsg) mem.push({ role: 'user', content: userMsg });
    if (botMsg) mem.push({ role: 'assistant', content: botMsg });
    await redis.set(K.mem(phone), mem.slice(-IFY.memory.turns), { ex: IFY.memory.ttlSec });
  } catch {
    /* non-fatal */
  }
}

// AI vs human handling. Once a human takes over, the AI stays out until the mode clears.
export async function getMode(phone) {
  if (!redis) return 'ai';
  try {
    return (await redis.get(K.mode(phone))) === 'human' ? 'human' : 'ai';
  } catch {
    return 'ai';
  }
}

export async function setMode(phone, mode) {
  if (!redis) return;
  try {
    if (mode === 'human') await redis.set(K.mode(phone), 'human', { ex: IFY.humanModeTtlSec });
    else await redis.del(K.mode(phone)); // 'ai' = no key
  } catch {
    /* non-fatal */
  }
}

// Per-session AI turn counter (enforces the "2–3 replies then suggest human" rule).
export async function bumpTurns(phone) {
  if (!redis) return 1;
  try {
    const n = await redis.incr(K.turns(phone));
    if (n === 1) await redis.expire(K.turns(phone), IFY.memory.ttlSec);
    return n;
  } catch {
    return 1;
  }
}

export async function resetTurns(phone) {
  if (!redis) return;
  try {
    await redis.del(K.turns(phone));
  } catch {
    /* non-fatal */
  }
}

// Per-number daily counter for non-users (protects the API bill).
export async function nonUserCount(phone) {
  if (!redis) return 0;
  try {
    const n = await redis.incr(K.nonuser(phone));
    if (n === 1) await redis.expire(K.nonuser(phone), 60 * 60 * 24);
    return n;
  } catch {
    return 0;
  }
}

// Durable log of every exchange — this is how you learn how people use it.
// Safe if the IfyMessage table doesn't exist yet (it just warns).
export async function logExchange({ phone, name, userId, inbound, reply, action, reason }) {
  try {
    await prisma.ifyMessage.create({
      data: {
        phone,
        name: name || null,
        userId: userId || null,
        inbound,
        reply: reply || null,
        action, // 'answer' | 'escalate' | 'ignored' | 'outreach'
        reason: reason || null,
      },
    });
  } catch (e) {
    log.warn('Ify', `log skipped: ${e.message}`);
  }
}
