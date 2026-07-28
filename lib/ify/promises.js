import prisma from '@/lib/prisma';
import { IFY } from './config';
import { log } from '@/lib/logger';

// Lagos = UTC+1, no DST.
const LAGOS_MS = 3600000;
const lagosHour = (d = new Date()) => new Date(d.getTime() + LAGOS_MS).getUTCHours();

// ── Due-window calculation ──────────────────────────────────────────────────

export function computeDueAt(category, suggestedHours) {
  const now = new Date();
  const h = lagosHour(now);
  const w = IFY.promises.dueWindows;

  let hours;
  if (suggestedHours != null && suggestedHours > 0) {
    hours = suggestedHours;
  } else {
    const window = w[category] ?? w.other;
    if (window === 'eod') {
      hours = h < 18 ? 18 - h : 1;
    } else {
      hours = window;
    }
  }

  let due = new Date(now.getTime() + hours * 3600000);

  const dueH = lagosHour(due);
  if (dueH >= IFY.promises.nightCutoff || dueH < IFY.promises.morningStart) {
    const lagos = new Date(due.getTime() + LAGOS_MS);
    if (dueH >= IFY.promises.nightCutoff) lagos.setUTCDate(lagos.getUTCDate() + 1);
    lagos.setUTCHours(IFY.promises.morningStart, 0, 0, 0);
    due = new Date(lagos.getTime() - LAGOS_MS);
  }

  return due;
}

// ── LLM helpers ─────────────────────────────────────────────────────────────

async function llmJson(systemPrompt, userText) {
  if (!IFY.llm.apiKey) return null;
  try {
    const res = await fetch(`${IFY.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${IFY.llm.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: IFY.llm.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return null;
  }
}

export async function detectPromise(messageText) {
  const result = await llmJson(
    `You detect follow-up promises in customer support messages. A promise is when the agent commits to doing something later: checking an order, chasing a provider, following up, processing a refund, etc.

Return JSON:
{"isPromise":boolean,"category":"order_status"|"provider_chase"|"refill"|"payment"|"refund_routing"|"escalation"|"other","suggestedDueHours":number,"promiseText":"the specific commitment"}

If no follow-up commitment, return {"isPromise":false}.`,
    messageText,
  );
  return result || { isPromise: false };
}

async function detectContinuation(messageText) {
  const result = await llmJson(
    `Does this customer support message fully resolve the issue, or is it a progress update that promises further follow-up?

Return JSON: {"fullyResolved":boolean,"suggestedFollowUpHours":number|null}
If "still chasing", "will update you again", "checking with our provider" → fullyResolved=false with hours.
If the issue is done → fullyResolved=true.`,
    messageText,
  );
  return result || { fullyResolved: true, suggestedFollowUpHours: null };
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function createPromise({ customerNumber, customerName, orderNumber, promiseText, category, owner, dueAt }) {
  const due = dueAt || computeDueAt(category);
  return prisma.ifyPromise.create({
    data: {
      customerNumber,
      customerName: customerName || null,
      orderNumber: orderNumber || null,
      promiseText,
      category,
      owner: owner || null,
      dueAt: due,
      state: 'open',
    },
  });
}

export async function addUpdate(promiseId, { author, messageSent, note }) {
  const update = await prisma.ifyPromiseUpdate.create({
    data: { promiseId, author, messageSent: messageSent || null, note: note || null },
  });
  await prisma.ifyPromise.update({
    where: { id: promiseId },
    data: { lastUpdateAt: new Date(), lastUpdateText: messageSent || note || null },
  });
  return update;
}

// Core rule: resolution requires a customer-facing update. If the message implies
// continuation ("still chasing"), a successor promise is created automatically.
export async function resolvePromise(id, { author, messageSent, note }) {
  if (!messageSent) {
    const prior = await prisma.ifyPromiseUpdate.findFirst({
      where: { promiseId: id, messageSent: { not: null } },
    });
    if (!prior) {
      throw new Error('Cannot resolve: no customer-facing message has been sent.');
    }
  }

  const now = new Date();

  if (messageSent) {
    await prisma.ifyPromiseUpdate.create({ data: { promiseId: id, author, messageSent, note } });
  }

  const promise = await prisma.ifyPromise.update({
    where: { id },
    data: {
      state: 'resolved',
      resolvedAt: now,
      resolutionNote: note || null,
      lastUpdateAt: now,
      lastUpdateText: messageSent || note || null,
    },
  });

  let successor = null;
  if (messageSent) {
    const check = await detectContinuation(messageSent);
    if (!check.fullyResolved) {
      successor = await createPromise({
        customerNumber: promise.customerNumber,
        customerName: promise.customerName,
        orderNumber: promise.orderNumber,
        promiseText: messageSent,
        category: promise.category,
        owner: promise.owner,
        dueAt: computeDueAt(promise.category, check.suggestedFollowUpHours),
      });
    }
  }

  return { resolved: true, successor };
}

// ── Reply-path hook ─────────────────────────────────────────────────────────

export async function detectAndCreatePromise({ replyText, customerNumber, customerName }) {
  if (!IFY.promises.enabled) return null;
  try {
    const result = await detectPromise(replyText);
    if (!result.isPromise) return null;
    return createPromise({
      customerNumber,
      customerName,
      promiseText: result.promiseText || replyText,
      category: result.category || 'other',
      dueAt: computeDueAt(result.category || 'other', result.suggestedDueHours),
    });
  } catch (e) {
    log.warn('Ify', `promise detection failed: ${e.message}`);
    return null;
  }
}

// ── Telegram notifications ──────────────────────────────────────────────────

async function tgSend(token, chatId, text) {
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

const notifyCrew = (text) => tgSend(process.env.CREW_BOT_TOKEN, process.env.CREW_GROUP_ID, text);
const notifyAdmin = (text) => tgSend(process.env.TG_BOT_TOKEN, process.env.TG_CHAT_ID, text);

function ago(dueAt) {
  const m = Math.round((Date.now() - dueAt.getTime()) / 60000);
  if (m < 60) return `${m} min`;
  return `${(m / 60).toFixed(1)}h`;
}

function until(dueAt) {
  const m = Math.round((dueAt.getTime() - Date.now()) / 60000);
  if (m < 60) return `${m} min`;
  return `${(m / 60).toFixed(1)}h`;
}

function promiseLine(p) {
  const name = p.customerName || p.customerNumber;
  const order = p.orderNumber ? ` [${p.orderNumber}]` : '';
  return `${name}${order} — "${p.promiseText.slice(0, 80)}"`;
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export async function tick() {
  if (!IFY.promises.enabled) return { skipped: true };

  const now = new Date();
  const soonCutoff = new Date(now.getTime() + IFY.promises.dueSoonMinutes * 60000);
  const escCutoff = new Date(now.getTime() - IFY.promises.escalateAfterMinutes * 60000);

  // open → due_soon
  const newSoon = await prisma.ifyPromise.findMany({
    where: { state: 'open', dueAt: { lte: soonCutoff } },
  });
  if (newSoon.length) {
    await prisma.ifyPromise.updateMany({
      where: { id: { in: newSoon.map((p) => p.id) } },
      data: { state: 'due_soon' },
    });
    for (const p of newSoon) {
      await notifyCrew(`<b>Warning — Promise due in ${until(p.dueAt)}</b>\n${promiseLine(p)}\nCategory: ${p.category}\nOwner: ${p.owner || 'unassigned'}`);
    }
  }

  // due_soon | open → overdue
  const newOverdue = await prisma.ifyPromise.findMany({
    where: { state: { in: ['due_soon', 'open'] }, dueAt: { lte: now } },
  });
  if (newOverdue.length) {
    await prisma.ifyPromise.updateMany({
      where: { id: { in: newOverdue.map((p) => p.id) } },
      data: { state: 'overdue' },
    });
    for (const p of newOverdue) {
      await notifyCrew(`<b>OVERDUE — Promise ${ago(p.dueAt)} late</b>\n${promiseLine(p)}\nCategory: ${p.category}\nOwner: ${p.owner || 'unassigned'}`);
    }
  }

  // overdue > escalateAfterMinutes with no post-due update → escalate to supervisor
  const toEscalate = await prisma.ifyPromise.findMany({
    where: { state: 'overdue', dueAt: { lte: escCutoff } },
  });
  const escalated = toEscalate.filter((p) => !p.lastUpdateAt || p.lastUpdateAt < p.dueAt);
  if (escalated.length) {
    await prisma.ifyPromise.updateMany({
      where: { id: { in: escalated.map((p) => p.id) } },
      data: { state: 'escalated' },
    });
    for (const p of escalated) {
      await notifyAdmin(`<b>ESCALATION — Unattended promise ${ago(p.dueAt)} overdue</b>\n${promiseLine(p)}\nCategory: ${p.category}\nOwner: ${p.owner || 'unassigned'}`);
    }
  }

  // Daily digest at morning start (first tick of the hour)
  const lagosMin = new Date(now.getTime() + LAGOS_MS).getUTCMinutes();
  if (lagosHour(now) === IFY.promises.morningStart && lagosMin < 15) {
    const open = await prisma.ifyPromise.findMany({
      where: { state: { in: ['open', 'due_soon', 'overdue', 'escalated'] } },
      orderBy: { dueAt: 'asc' },
    });
    if (open.length) {
      const overdueCount = open.filter((p) => p.state === 'overdue' || p.state === 'escalated').length;
      const soonCount = open.filter((p) => p.state === 'due_soon').length;
      const openCount = open.filter((p) => p.state === 'open').length;
      let digest = `<b>Daily Promise Digest</b>\n\nOverdue: ${overdueCount}\nDue soon: ${soonCount}\nOpen: ${openCount}\n`;
      const top5 = open.slice(0, 5);
      for (const p of top5) {
        digest += `\n[${p.state}] ${promiseLine(p)} — due ${p.dueAt.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })}`;
      }
      if (open.length > 5) digest += `\n…and ${open.length - 5} more`;
      await notifyCrew(digest);
    }
  }

  return {
    dueSoon: newSoon.length,
    overdue: newOverdue.length,
    escalated: escalated.length,
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export async function getMetrics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [all, resolved, overdue] = await Promise.all([
    prisma.ifyPromise.findMany({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.ifyPromise.findMany({ where: { state: 'resolved', resolvedAt: { gte: thirtyDaysAgo } }, include: { updates: true } }),
    prisma.ifyPromise.groupBy({ by: ['owner'], where: { state: { in: ['overdue', 'escalated'] } }, _count: true }),
  ]);

  const keptOnTime = resolved.filter((p) => p.resolvedAt && p.resolvedAt <= p.dueAt).length;
  const totalResolved = resolved.length;

  const avgFirstUpdate = resolved.reduce((sum, p) => {
    const first = p.updates.sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!first) return sum;
    return sum + (first.createdAt.getTime() - p.createdAt.getTime());
  }, 0);

  const byCategory = {};
  for (const p of all) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }

  return {
    period: '30d',
    keptOnTime,
    totalResolved,
    keptOnTimeRate: totalResolved ? +(keptOnTime / totalResolved * 100).toFixed(1) : null,
    avgFirstUpdateMs: totalResolved ? Math.round(avgFirstUpdate / totalResolved) : null,
    overdueByOwner: overdue.map((r) => ({ owner: r.owner || 'unassigned', count: r._count })),
    byCategory,
  };
}
