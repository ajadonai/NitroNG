// lib/ify/handle.js
// Orchestrator: identity → memory → brain → (answer | escalate) → send → log.
// Respects human takeover and the "2–3 replies then suggest a human" rule.

import { IFY, isAllowed } from './config';
import { resolveUser } from './identity';
import {
  getMemory, pushMemory, markSeen, getMode, setMode,
  bumpTurns, resetTurns, nonUserCount, logExchange,
} from './store';
import { decide } from './brain';
import { escalate } from './escalate';
import { sendText, markRead } from './whatsapp';
import { detectAndCreatePromise, createPromise, computeDueAt } from './promises';
import { log } from '@/lib/logger';

export async function handleInbound({ from, text, name, messageId }) {
  try {
    if (!IFY.enabled) return;                 // kill switch
    if (!isAllowed(from)) return;              // soft-launch allowlist
    if (!(await markSeen(messageId))) return;  // ignore Meta re-deliveries
    await markRead(messageId);
    if ((await getMode(from)) === 'human') return; // a person is handling this chat
    if (!text || !text.trim()) return;         // text-only in v1

    const user = await resolveUser(from);

    // Non-user metering — answer a capped number/day, then stay quiet.
    if (!user) {
      const n = await nonUserCount(from);
      if (n > IFY.limits.nonUserPerDay) {
        await logExchange({ phone: from, name, userId: null, inbound: text, reply: null, action: 'ignored', reason: 'non-user daily cap' });
        return;
      }
    }

    const history = await getMemory(from);
    let { action, message, reason } = await decide({ user, history, message: text });

    // Enforce the turn limit: after maxAiTurns unresolved AI replies, hand to a human.
    if (action === 'answer') {
      const turns = await bumpTurns(from);
      if (turns > IFY.persona.maxAiTurns) {
        action = 'escalate';
        reason = `turn limit (${turns})`;
        message = '';
      }
    }

    if (action === 'escalate') {
      const handoff = await escalate({ from, name, user, message: text, reason, history });
      await sendText(from, handoff);
      createPromise({
        customerNumber: from,
        customerName: name,
        promiseText: handoff,
        category: 'escalation',
        dueAt: computeDueAt('escalation'),
      }).catch(() => {});
      await setMode(from, 'human');
      await resetTurns(from);
      await pushMemory(from, text, handoff);
      await logExchange({ phone: from, name, userId: user?.id || null, inbound: text, reply: handoff, action: 'escalate', reason });
      return;
    }

    await sendText(from, message);
    detectAndCreatePromise({ replyText: message, customerNumber: from, customerName: name }).catch(() => {});
    await pushMemory(from, text, message);
    await logExchange({ phone: from, name, userId: user?.id || null, inbound: text, reply: message, action: 'answer', reason });
  } catch (e) {
    log.error('Ify', `handleInbound failed: ${e.message}`);
  }
}
