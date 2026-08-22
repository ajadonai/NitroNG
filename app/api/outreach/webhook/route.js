import prisma from '@/lib/prisma';
import { OUTREACH_TOPIC_TO_TOUCH, outreachWhatsAppMessage, outreachButtons, tgOutreachReplacement, STAFF_NAMES } from '@/lib/telegram';
import { callbackOptions, watWhen, watLabel, scheduleRetry, nextWorkingMorning, tooLateForReplacement } from '@/lib/outreach-time';
import { pullReplacements, poolWhere } from '@/lib/outreach-pool';
import {
  TOUCH_LABEL, message, block, row, outcomeRows, touchRows, staffRows, pct, naira,
} from '@/lib/outreach-format';

// "Switched off" this many times and the phone is cleared for good.
const UNREACHABLE_STRIKE_LIMIT = 2;

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The recycler stamps released contacts "expired" with no staff against them.
// Counting those as work is how a morning with 89 real calls reported 389.
const HUMAN_WORK = { method: { not: 'expired' } };

const TOKEN = process.env.OUTREACH_BOT_TOKEN;
const SECRET = process.env.CRON_SECRET;
const SITE = 'https://nitro.ng';

// Eshiema handed over to Ify on 22 Aug; her ID stays in STAFF_NAMES so past
// contacts still read as hers, but it no longer grants access.
const OUTREACH_STAFF = ['8567146346', '8939794301'];

function staffName(tgId) {
  return STAFF_NAMES[String(tgId)] || `Staff ${String(tgId).slice(-4)}`;
}

function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// The name always sits on the first line, but the shape differs by card: batch
// cards read "12. Name", while callback and replacement cards read
// "CALL BACK — Name" / "REPLACEMENT — Name" behind an emoji.
function parseName(msg) {
  const line = msg?.text?.split('\n')[0]?.trim() || '';
  const m = line.match(/^\d+\.\s*(.+)$/)
    || line.match(/(?:CALL BACK|REPLACEMENT)\s*[–—-]\s*(.+)$/);
  return m?.[1]?.trim() || 'User';
}

function editMsg(chatId, messageId, text, replyMarkup) {
  return tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });
}

function buildWaUrl(phone, touchType, name, { variant = 'noAnswer', creditNaira } = {}) {
  const text = outreachWhatsAppMessage(touchType, name, { variant, creditNaira });
  if (!text) return `https://wa.me/${phone}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

// A contact is still open while a callback or an automatic no-answer retry is
// pending, so its re-posted card can be actioned. Anything else is a finished
// outcome and stays with whoever logged it.
async function claim(userId, touchType, callbackId) {
  const existing = await prisma.outreachContact.findFirst({ where: { userId, touchType } });
  // "expired" means the recycler released a card nobody worked. If it comes round
  // again it must be actionable, otherwise the second chance is not one.
  const open = existing
    && (existing.callbackAt !== null || existing.method === 'callback' || existing.method === 'expired');
  if (existing && !open) {
    await tg('answerCallbackQuery', {
      callback_query_id: callbackId,
      text: `Already handled by ${staffName(existing.contactedBy)}`,
      show_alert: true,
    });
    return { blocked: true };
  }
  return { blocked: false, existing };
}

// Writes the outcome. Upserts on the (userId, touchType) unique key so two staff
// tapping at the same instant cannot produce two rows for one contact.
function recordContact(_existing, { userId, touchType, tgUserId, method, callbackAt = null }) {
  // contactedAt is stamped on update too: a recycled or released row already
  // exists, and every reader treats this column as when the work happened.
  // Left at its default it would keep the old date and today's stats would
  // count the card as still open.
  const data = { method, contactedBy: String(tgUserId), callbackAt, contactedAt: new Date() };
  return prisma.outreachContact.upsert({
    where: { userId_touchType: { userId, touchType } },
    create: { userId, touchType, ...data },
    update: data,
  });
}

// A contact that can never be worked costs the day a slot, so pull a fresh one
// from the same pool and post it to the same topic. Best effort: if the pool is
// dry there is simply nothing to give back.
async function replaceSlot(touchType) {
  // Late in the day a fresh card cannot be worked before close, so the slot is
  // left as a gap and rolls into tomorrow rather than piling up unworked.
  if (tooLateForReplacement()) return 'late';
  try {
    const fresh = await pullReplacements(touchType, 1);
    if (fresh.length) await tgOutreachReplacement(fresh, touchType);
    return fresh.length;
  } catch {
    return 0;
  }
}

// Appends the replacement outcome to a toast. Distinguishes a dry pool from the
// end-of-day cutoff, so staff are not left wondering why nothing arrived.
const withReplacement = (text, filled) =>
  filled === 'late' ? `${text} Too late for a replacement — it rolls to tomorrow.`
  : filled ? `${text} Replacement sent.`
  : `${text} No replacement available.`;

export async function POST(req) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!SECRET || secret !== SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();

    if (body.callback_query) {
      const { id, data, message, from } = body.callback_query;
      const threadId = message?.message_thread_id;
      const tgUserId = from?.id;
      const clicker = staffName(tgUserId);

      if (data !== 'n' && !OUTREACH_STAFF.includes(String(tgUserId))) {
        await tg('answerCallbackQuery', {
          callback_query_id: id,
          text: "You don't have access to outreach actions.",
          show_alert: true,
        });
        return Response.json({ ok: true });
      }

      if (data.startsWith('r:')) {
        const userId = data.slice(2);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked, existing } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        await recordContact(existing, { userId, touchType, tgUserId, method: 'call' });
        // Reaching them proves the phone works, so any "switched off" strikes go.
        await prisma.user.updateMany({
          where: { id: userId, unreachableStrikes: { gt: 0 } },
          data: { unreachableStrikes: 0 },
        });
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, phone: true },
        });
        const phone = user?.phone?.replace('+', '') || '';
        const userName = parseName(message);
        const waUrl = phone ? buildWaUrl(phone, touchType, user?.name || userName, { variant: 'reached' }) : null;
        const buttons = waUrl
          ? { inline_keyboard: [[{ text: 'Follow up on WhatsApp', url: waUrl }]] }
          : undefined;
        await editMsg(message.chat.id, message.message_id, `\u{2705} <b>${userName}</b> \u{2014} called by ${clicker}`, buttons);
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Reached! Marked as called.' });

      } else if (data.startsWith('na:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked, existing } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        // A valid number that did not pick up is worth another call. Without this
        // the only exit is the WhatsApp button, which dead-ends while on penalty.
        const retryAt = scheduleRetry(3);
        await recordContact(existing, { userId, touchType, tgUserId, method: 'pending', callbackAt: retryAt });
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, phone: true },
        });
        const phone = user?.phone?.replace('+', '') || '';
        const name = user?.name || '(no name)';
        const short = name.length > 18 ? name.slice(0, 16) + '..' : name;
        const waUrl = phone ? buildWaUrl(phone, touchType, name, { variant: 'noAnswer' }) : null;
        const userName = parseName(message);
        const buttons = waUrl
          ? [
              [{ text: `Send WhatsApp to ${short}`, url: waUrl }],
              [{ text: 'Sent', callback_data: `ws:${userId}` }],
            ]
          : [[{ text: 'No phone on file', callback_data: 'n' }]];
        await editMsg(
          message.chat.id, message.message_id,
          `<b>${userName}</b> \u{2014} no answer, retry ${watWhen(retryAt)} (${clicker})`,
          { inline_keyboard: buttons },
        );
        await tg('answerCallbackQuery', { callback_query_id: id, text: `No answer. Retrying ${watWhen(retryAt)}.` });

      } else if (data.startsWith('ws:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        // WhatsApp went out, so the automatic call retry is no longer needed.
        await prisma.outreachContact.updateMany({
          where: { userId, touchType, method: 'pending' },
          data: { method: 'whatsapp', callbackAt: null },
        });
        const wsName = parseName(message);
        await editMsg(message.chat.id, message.message_id, `\u{2705} <b>${wsName}</b> \u{2014} WA by ${clicker}`);
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'WhatsApp sent! Done.' });

      } else if (data.startsWith('dnc:')) {
        const userId = data.slice(4);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        await prisma.user.update({ where: { id: userId }, data: { outreachOptedOutAt: new Date() } });
        // Record it as an outcome. Without a row, opt-outs are invisible in stats
        // and the weekly summary, so nobody can see how many people are asking to
        // be left alone. DNC is deliberately not gated on the claim check: someone
        // can ask to be dropped after they have already been reached.
        await recordContact(null, { userId, touchType, tgUserId, method: 'dnc' });
        // Cancel any callback or retry already queued, so someone who just asked
        // not to be contacted cannot be re-posted by the callbacks cron.
        await prisma.outreachContact.updateMany({ where: { userId }, data: { callbackAt: null } });
        const dncName = parseName(message);
        await editMsg(message.chat.id, message.message_id, `\u{1F6AB} <b>${dncName}</b> \u{2014} Do not contact`, { inline_keyboard: [] });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as Do Not Contact' });

      } else if (data.startsWith('wn:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked, existing } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        await recordContact(existing, { userId, touchType, tgUserId, method: 'wrong_number' });
        await prisma.user.update({ where: { id: userId }, data: { phone: null } });
        const wnName = parseName(message);
        await editMsg(message.chat.id, message.message_id, `\u{274C} <b>${wnName}</b> \u{2014} wrong number (${clicker})`);
        const wnFilled = await replaceSlot(touchType);
        await tg('answerCallbackQuery', {
          callback_query_id: id,
          text: withReplacement('Wrong number. Phone cleared.', wnFilled),
        });

      } else if (data.startsWith('ur:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        // Nigerian networks play different messages for a handset that is off and
        // a line that was never allocated, so staff can tell them apart. The two
        // deserve opposite treatment, hence the second tap.
        await editMsg(
          message.chat.id, message.message_id,
          `\u{1F4F5} <b>${parseName(message)}</b> \u{2014} what happened?`,
          { inline_keyboard: [
            [{ text: 'Switched off', callback_data: `uro:${userId}` },
             { text: 'Not in service', callback_data: `urn:${userId}` }],
            [{ text: '\u{2190} Back', callback_data: `cbx:${userId}` }],
          ] },
        );
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Which one?' });

      } else if (data.startsWith('uro:')) {
        const userId = data.slice(4);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked, existing } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        // Name comes from the record, not the card: the "what happened?" edit has
        // already replaced the text parseName would have read.
        const before = await prisma.user.findUnique({ where: { id: userId }, select: { unreachableStrikes: true, name: true } });
        const strikes = (before?.unreachableStrikes || 0) + 1;
        const spent = strikes >= UNREACHABLE_STRIKE_LIMIT;
        await prisma.user.update({
          where: { id: userId },
          data: spent ? { unreachableStrikes: strikes, phone: null } : { unreachableStrikes: strikes },
        });
        // First strike goes to the back of the queue for tomorrow. Second gives up
        // and clears the phone, the same end state as a wrong number.
        const retryAt = spent ? null : nextWorkingMorning();
        await recordContact(existing, { userId, touchType, tgUserId, method: 'unreachable', callbackAt: retryAt });
        const uroName = before?.name || '(no name)';
        await editMsg(
          message.chat.id, message.message_id,
          spent
            ? `\u{1F4F5} <b>${uroName}</b> \u{2014} switched off ${strikes}\u{00D7}, given up (${clicker})`
            : `\u{1F4F5} <b>${uroName}</b> \u{2014} switched off, retry ${watWhen(retryAt)} (${clicker})`,
        );
        const uroFilled = await replaceSlot(touchType);
        await tg('answerCallbackQuery', {
          callback_query_id: id,
          text: withReplacement(
            spent ? `Strike ${strikes}. Phone cleared.` : `Strike ${strikes}. Retrying ${watWhen(retryAt)}.`,
            uroFilled,
          ),
        });

      } else if (data.startsWith('urn:')) {
        const userId = data.slice(4);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked, existing } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        // The line does not exist, so no retry will ever help. Same end state as
        // a wrong number: clear the phone so every later touch skips them.
        await recordContact(existing, { userId, touchType, tgUserId, method: 'not_in_service' });
        // Read the name before clearing, and from the record rather than the card,
        // whose text the "what happened?" edit has already replaced.
        const urnUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await prisma.user.update({ where: { id: userId }, data: { phone: null } });
        const urnName = urnUser?.name || '(no name)';
        await editMsg(message.chat.id, message.message_id, `\u{274C} <b>${urnName}</b> \u{2014} not in service (${clicker})`);
        const urnFilled = await replaceSlot(touchType);
        await tg('answerCallbackQuery', {
          callback_query_id: id,
          text: withReplacement('Not in service. Phone cleared.', urnFilled),
        });

      } else if (data.startsWith('cb:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const cbName = user?.name || parseName(message);
        // Options carry the absolute time, so a slow tap cannot drift the callback.
        const opts = callbackOptions();
        const rows = [];
        for (let i = 0; i < opts.length; i += 3) {
          rows.push(opts.slice(i, i + 3).map(o => ({
            text: o.label,
            callback_data: `cbt:${userId}:${Math.floor(o.at.getTime() / 60000)}`,
          })));
        }
        rows.push([{ text: '\u{2190} Back', callback_data: `cbx:${userId}` }]);
        await editMsg(message.chat.id, message.message_id, `\u{23F0} <b>${cbName}</b> \u{2014} when?`, { inline_keyboard: rows });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Pick a time' });

      } else if (data.startsWith('cbt:')) {
        const [, userId, mins] = data.split(':');
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const { blocked, existing } = await claim(userId, touchType, id);
        if (blocked) return Response.json({ ok: true });
        const at = new Date(Number(mins) * 60000);
        await recordContact(existing, { userId, touchType, tgUserId, method: 'callback', callbackAt: at });
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const when = watWhen(at);
        await editMsg(
          message.chat.id, message.message_id,
          `\u{23F0} <b>${user?.name || '(no name)'}</b> \u{2014} call back ${when} (${clicker})`,
        );
        await tg('answerCallbackQuery', { callback_query_id: id, text: `Call back set for ${when}` });

      } else if (data.startsWith('cbx:')) {
        const userId = data.slice(4);
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } });
        const cbxName = user?.name || '(no name)';
        const cbxPhone = user?.phone?.replace('+', '') || '';
        await editMsg(
          message.chat.id, message.message_id,
          cbxPhone ? `<b>${cbxName}</b>\n\u{1F4F1} +${cbxPhone}` : `<b>${cbxName}</b> \u{2014} no phone`,
          { inline_keyboard: outreachButtons(userId) },
        );
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Cancelled' });

      } else if (data === 'n') {
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Already handled' });
      }
    }

    if (body.message?.text?.startsWith('/')) {
      const parts = body.message.text.trim().split(/\s+/);
      const cmd = parts[0].replace(/@\w+$/, '');
      const arg = parts.slice(1).join(' ');
      const chatId = body.message.chat.id;
      const threadId = body.message.message_thread_id;
      const tgUserId = String(body.message.from?.id);

      const isNitro = tgUserId === '8567146346';
      const isStaff = OUTREACH_STAFF.includes(tgUserId);
      if (!isStaff && cmd !== '/start' && cmd !== '/help') return Response.json({ ok: true });
      if (!isNitro && cmd !== '/start' && cmd !== '/help' && cmd !== '/pending') return Response.json({ ok: true });

      const send = (text) => tg('sendMessage', {
        chat_id: chatId,
        ...(threadId ? { message_thread_id: threadId } : {}),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      if (cmd === '/start' || cmd === '/help') {
        await send(
          '\u{1F4CB} <b>Nitro Outreach Bot</b>\n\n'
          + '<b>Call first, then tap what happened:</b>\n\n'
          + '\u{2705} <b>Reached</b> \u{2014} you spoke to them\n'
          + '\u{1F4F5} <b>No answer</b> \u{2014} rang out. Retries by itself in 3h\n'
          + '\u{23F0} <b>Call back</b> \u{2014} they asked for a time. Pick it and the card comes back then\n'
          + '\u{1F4F4} <b>Unreachable</b> \u{2014} then choose:\n'
          + '      <i>Switched off</i> \u{2014} returns tomorrow, twice, then stops\n'
          + '      <i>Not in service</i> \u{2014} dead line, dropped for good\n'
          + '\u{274C} <b>Wrong number</b> \u{2014} someone else answered\n'
          + '\u{1F6AB} <b>DNC</b> \u{2014} they asked to be left alone\n\n'
          + 'Unreachable, Not in service and Wrong number each pull a fresh contact '
          + 'to fill the slot, so your list does not shrink.\n\n'
          + '<b>Commands:</b>\n'
          + '/pending \u{2014} what is still open today\n'
          + '/callbacks \u{2014} call backs due today, for the topic you ask in\n'
          + '/stats \u{2014} today\u{2019}s numbers, or /stats <i>name</i> for one person\n'
          + '/dnc \u{2014} do-not-contact count\n'
          + '/leaderboard \u{2014} staff, last 30 days\n',
        );

      } else if (cmd === '/pending') {
        // A count per topic, not a name dump. The cards live in the topics with
        // their buttons, so a list of names in a message is not actionable — and
        // the old version ran to four chunked pages of it.
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        // Handed out per stamp, so open work can be traced back to a topic. Backlog
        // reuses day1's stamp, so those two can only ever be counted together.
        const stamped = (field) => prisma.user.count({ where: { [field]: { gte: todayStart } } });
        const [handed, worked] = await Promise.all([
          Promise.all([
            stamped('outreachDay1SentAt'), stamped('outreachDay3SentAt'),
            stamped('outreachDay7SentAt'), stamped('outreachWinbackSentAt'),
          ]),
          prisma.outreachContact.groupBy({
            by: ['touchType'],
            where: { contactedAt: { gte: todayStart }, ...HUMAN_WORK },
            _count: true,
          }),
        ]);
        const sent = handed.reduce((a, b) => a + b, 0);
        const done = worked.reduce((a, r) => a + r._count, 0);
        const open = Math.max(0, sent - done);
        if (!sent) {
          await send('\u{1F4CB} <b>Outreach \u{2014} today</b>\n\nNothing out yet. The first list lands at 09:00.');
        } else if (!open) {
          await send(`\u{2705} <b>Outreach \u{2014} today</b>\n\nAll ${sent} contacted. Nothing left.`);
        } else {
          const byTouch = Object.fromEntries(worked.map(r => [r.touchType, r._count]));
          const [d1, d3, d7, wb] = handed;
          // Which topic to open, which is the only thing this command is for. The
          // old version showed what had been worked, which answers the opposite
          // question.
          const openRows = [
            ['First Call + Backlog', d1 - (byTouch.day1 || 0) - (byTouch.backlog || 0)],
            ['Follow-up', d3 - (byTouch.day3 || 0)],
            ['Final Nudge', d7 - (byTouch.day7 || 0)],
            ['Winback', wb - (byTouch.winback || 0)],
          ]
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([labelText, n]) => row('', labelText, n));
          // The three numbers first, on their own, before anything else. This is
          // the question the command exists to answer.
          await send(message(
            '\u{1F4CB} <b>Outreach \u{2014} today</b>',
            [
              row('\u{1F4C7}', 'Total', sent),
              row('\u{2705}', 'Contacted', done, `${pct(done, sent)}%`),
              row('\u{23F3}', 'Left', open),
            ].join('\n'),
            block('Left by touch', openRows),
          ));
        }

      } else if (cmd === '/callbacks') {
        // Names and times, unlike /pending: each of these is owed to a specific
        // person at a specific time, so the detail is the point.
        // Asked inside a touch topic, it answers for that touch only — a Winback
        // call back has no business showing up in First Call. Asked in General
        // (or a non-touch topic like Summary) it answers for the whole day.
        const scope = TOUCH_LABEL[OUTREACH_TOPIC_TO_TOUCH[threadId]]
          ? OUTREACH_TOPIC_TO_TOUCH[threadId]
          : null;
        const dayEnd = new Date();
        dayEnd.setUTCHours(23, 59, 59, 999);
        const due = await prisma.outreachContact.findMany({
          where: {
            callbackAt: { not: null, lte: dayEnd },
            method: { in: ['callback', 'pending'] },
            ...(scope ? { touchType: scope } : {}),
            user: { status: 'Active', outreachOptedOutAt: null, phone: { not: null } },
          },
          select: {
            callbackAt: true, touchType: true, contactedBy: true, method: true,
            user: { select: { name: true, phone: true } },
          },
          orderBy: { callbackAt: 'asc' },
          take: 25,
        });
        if (!due.length) {
          await send(scope
            ? `\u{23F0} No ${TOUCH_LABEL[scope]} call backs due today.`
            : '\u{23F0} No call backs due today.');
        } else {
          const now = new Date();
          const lines = due.map(c => {
            const overdue = c.callbackAt < now ? ' \u{26A0}' : '';
            const kind = c.method === 'pending' ? 'retry' : 'asked';
            const phone = c.user?.phone?.replace('+', '') || 'no phone';
            const touch = scope ? '' : `${TOUCH_LABEL[c.touchType] || c.touchType} \u{00B7} `;
            return `<b>${watLabel(c.callbackAt)}</b>${overdue} \u{2014} ${c.user?.name || '(no name)'}\n`
              + `  \u{1F4F1} ${phone} \u{00B7} ${touch}${kind} \u{00B7} ${staffName(c.contactedBy)}`;
          });
          const late = due.filter(c => c.callbackAt < now).length;
          await send(message(
            `\u{23F0} <b>Call backs \u{2014} ${due.length} due today${scope ? `, ${TOUCH_LABEL[scope]}` : ''}</b>`
            + (late ? `\n${row('\u{26A0}', 'Overdue', late)}` : ''),
            lines.join('\n'),
          ));
        }

      } else if (cmd === '/dnc') {
        const [total, recent] = await Promise.all([
          prisma.user.count({ where: { outreachOptedOutAt: { not: null } } }),
          prisma.user.findMany({
            where: { outreachOptedOutAt: { not: null } },
            select: { name: true, outreachOptedOutAt: true },
            orderBy: { outreachOptedOutAt: 'desc' },
            take: 5,
          }),
        ]);
        if (!total) {
          await send('Nobody on the do-not-contact list.');
        } else {
          await send(message(
            `\u{1F6AB} <b>Do not contact \u{2014} ${total} ${total === 1 ? 'person' : 'people'}</b>`,
            block('Most recent', recent.map(u => row(
              '\u{1F464}',
              u.name || '(no name)',
              u.outreachOptedOutAt.toISOString().slice(0, 10),
            ))),
          ));
        }

      } else if (cmd === '/stats' && arg) {
        // One staff member at a time. /stats is already Nitro-only by the guard
        // above, so this needs no permission check of its own.
        const target = Object.entries(STAFF_NAMES).find(
          ([tgId, name]) => name.toLowerCase() === arg.toLowerCase() || tgId === arg,
        );
        if (!target) {
          await send(
            `No staff called <b>${esc(arg)}</b>.\n\nTry: `
            + Object.values(STAFF_NAMES).map(n => n.toLowerCase()).join(', '),
          );
        } else {
          const [staffId, name] = target;
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
          const dayEnd = new Date();
          dayEnd.setUTCHours(23, 59, 59, 999);
          const [today, month, owed] = await Promise.all([
            prisma.outreachContact.findMany({
              where: { contactedAt: { gte: todayStart }, contactedBy: staffId, ...HUMAN_WORK },
              select: { method: true, touchType: true },
            }),
            prisma.outreachContact.findMany({
              where: { contactedAt: { gte: thirtyDaysAgo }, contactedBy: staffId, ...HUMAN_WORK },
              select: { method: true },
            }),
            // Only what is actually due: counting every future call back as well
            // turns an actionable number into a standing total nobody can clear.
            prisma.outreachContact.count({
              where: { contactedBy: staffId, callbackAt: { not: null, lte: dayEnd } },
            }),
          ]);
          const counts = {};
          const touches = {};
          today.forEach(c => {
            counts[c.method] = (counts[c.method] || 0) + 1;
            touches[c.touchType] = (touches[c.touchType] || 0) + 1;
          });
          const reachedToday = counts.call || 0;
          const reachedMonth = month.filter(c => c.method === 'call').length;
          await send(message(
            `\u{1F4CA} <b>${name} \u{2014} today, ${watLabel(new Date())} WAT</b>`,
            block('Today', [
              row('\u{1F4C7}', 'Worked', today.length),
              row('\u{2705}', 'Reached', reachedToday, today.length ? `${pct(reachedToday, today.length)}%` : null),
              owed ? row('\u{23F0}', 'Call backs due', owed) : null,
            ]),
            block('Outcomes', outcomeRows(counts)),
            block('By touch', touchRows(touches)),
            block('Last 30 days', [
              row('\u{1F4C7}', 'Worked', month.length),
              row('\u{2705}', 'Reached', reachedMonth, month.length ? `${pct(reachedMonth, month.length)}%` : null),
            ]),
          ));
        }

      } else if (cmd === '/stats') {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        // Handed out vs worked is the number that matters: for a long time most
        // of what went out was never touched, and nothing surfaced that.
        const [sent, contacts] = await Promise.all([
          prisma.user.count({
            where: {
              OR: [
                { outreachDay1SentAt: { gte: todayStart } },
                { outreachDay3SentAt: { gte: todayStart } },
                { outreachDay7SentAt: { gte: todayStart } },
                { outreachWinbackSentAt: { gte: todayStart } },
              ],
            },
          }),
          prisma.outreachContact.findMany({
            where: { contactedAt: { gte: todayStart }, ...HUMAN_WORK },
            select: { method: true, contactedBy: true },
          }),
        ]);
        const worked = contacts.length;
        const counts = {};
        contacts.forEach(c => { counts[c.method] = (counts[c.method] || 0) + 1; });
        const byStaff = {};
        contacts.forEach(c => {
          const n = staffName(c.contactedBy);
          byStaff[n] = (byStaff[n] || 0) + 1;
        });

        // A rate with nothing beside it is not a reading. Yesterday is the closest
        // fair comparison: same staff, same shift, same kind of list.
        const yStart = new Date(todayStart.getTime() - 86400000);
        const yesterday = await prisma.outreachContact.findMany({
          where: { contactedAt: { gte: yStart, lt: todayStart }, ...HUMAN_WORK },
          select: { method: true },
        });
        const yReached = yesterday.filter(c => c.method === 'call').length;
        const reached = counts.call || 0;

        // How many people are left to call. A touch at zero means tomorrow's list
        // for that topic will be empty, which is worth knowing before it happens.
        const pools = await Promise.all(
          ['day1', 'day3', 'day7', 'backlog'].map(t =>
            prisma.user.count({ where: { ...poolWhere(t), phone: { not: null } } })),
        );

        await send(message(
          `\u{1F4CA} <b>Outreach \u{2014} today, ${watLabel(new Date())} WAT</b>`,
          [
            row('\u{1F4C7}', 'Total', sent),
            row('\u{2705}', 'Contacted', worked, yesterday.length ? `${yesterday.length} yesterday` : null),
            row('\u{23F3}', 'Left', Math.max(0, sent - worked)),
            row('\u{1F3AF}', 'Reach rate', `${pct(reached, worked)}%`,
              yesterday.length ? `${pct(yReached, yesterday.length)}% yesterday` : null),
          ].join('\n'),
          block('Outcomes', outcomeRows(counts)),
          block('Staff', staffRows(byStaff)),
          block('Pool left', [
            row('', 'First Call', pools[0].toLocaleString()),
            row('', 'Follow-up', pools[1].toLocaleString()),
            row('', 'Final Nudge', pools[2].toLocaleString()),
            row('', 'Backlog', pools[3].toLocaleString()),
          ]),
        ));

      } else if (cmd === '/leaderboard') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const contacts = await prisma.outreachContact.findMany({
          // "expired" is written by the recycler, not by a person, so it would
          // otherwise credit staff with work nobody did.
          where: { contactedAt: { gte: thirtyDaysAgo }, ...HUMAN_WORK },
          select: { contactedBy: true, method: true, userId: true, contactedAt: true },
        });

        // Volume and reach rate say who works hard, not whose calls earn anything.
        // Only deposits landing after the call are counted, so someone who was
        // always going to pay is not credited to whoever happened to ring them.
        const reachedIds = [...new Set(contacts.filter(c => c.method === 'call').map(c => c.userId))];
        const deposits = reachedIds.length
          ? await prisma.transaction.findMany({
            where: {
              userId: { in: reachedIds }, type: 'deposit', status: 'Completed',
              createdAt: { gte: thirtyDaysAgo },
            },
            select: { userId: true, amount: true, createdAt: true },
          })
          : [];
        const depositsBy = {};
        for (const d of deposits) (depositsBy[d.userId] ||= []).push(d);

        const board = {};
        const credited = new Set();
        contacts.forEach(c => {
          const name = staffName(c.contactedBy);
          if (!board[name]) board[name] = { total: 0, reached: 0, converted: 0, sum: 0 };
          board[name].total++;
          if (c.method !== 'call') return;
          board[name].reached++;
          const after = (depositsBy[c.userId] || []).filter(d => d.createdAt >= c.contactedAt);
          // One person can be reached on more than one touch; count them once.
          if (after.length && !credited.has(c.userId)) {
            credited.add(c.userId);
            board[name].converted++;
            board[name].sum += after.reduce((a, d) => a + Number(d.amount || 0), 0);
          }
        });
        const sorted = Object.entries(board).sort((a, b) => b[1].total - a[1].total);
        if (!sorted.length) {
          await send('No outreach activity in the last 30 days.');
        } else {
          await send(message(
            '\u{1F3C6} <b>Leaderboard \u{2014} last 30 days</b>',
            block('Worked', sorted.map(([name, st]) => row(
              '\u{1F464}', name, st.total, `${st.reached} reached, ${pct(st.reached, st.total)}%`,
            ))),
            block('Deposits after their call', sorted
              .filter(([, st]) => st.converted)
              .map(([name, st]) => row('\u{1F464}', name, st.converted, naira(st.sum)))),
          ));
        }
      }
    }
  } catch (err) {
    console.error('Outreach webhook error:', err);
    try {
      await tg('sendMessage', {
        chat_id: '8567146346',
        text: `\u{26A0}\u{FE0F} Webhook error: ${err.message || err}`,
      });
    } catch {}
  }

  return Response.json({ ok: true });
}
