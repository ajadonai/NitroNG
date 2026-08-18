import prisma from '@/lib/prisma';
import { OUTREACH_TOPIC_TO_TOUCH, outreachWhatsAppMessage, outreachButtons, tgOutreachReplacement, STAFF_NAMES } from '@/lib/telegram';
import { callbackOptions, watWhen, scheduleRetry, nextWorkingMorning } from '@/lib/outreach-time';
import { pullReplacements } from '@/lib/outreach-pool';

// "Switched off" this many times and the phone is cleared for good.
const UNREACHABLE_STRIKE_LIMIT = 2;

const TOKEN = process.env.OUTREACH_BOT_TOKEN;
const SECRET = process.env.CRON_SECRET;
const SITE = 'https://nitro.ng';

const OUTREACH_STAFF = ['8567146346', '8911494544'];

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

async function sendChunked(send, header, lines, perPage = 25) {
  for (let i = 0; i < lines.length; i += perPage) {
    const chunk = lines.slice(i, i + perPage);
    const page = Math.floor(i / perPage) + 1;
    const pages = Math.ceil(lines.length / perPage);
    const suffix = pages > 1 ? ` (${page}/${pages})` : '';
    await send(`${header}${suffix}\n${chunk.join('\n')}`);
  }
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
  const open = existing && (existing.callbackAt !== null || existing.method === 'callback');
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
  const data = { method, contactedBy: String(tgUserId), callbackAt };
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
  try {
    const fresh = await pullReplacements(touchType, 1);
    if (fresh.length) await tgOutreachReplacement(fresh, touchType);
    return fresh.length;
  } catch {
    return 0;
  }
}

// Appends the replacement outcome to a toast. Worded so it reads the same whether
// the pool ran dry or, as with winback, replacements never applied.
const withReplacement = (text, filled) => `${text}${filled ? ' Replacement sent.' : ' No replacement available.'}`;

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
      const cmd = body.message.text.split(/\s/)[0].replace(/@\w+$/, '');
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
          + '<b>Workflow:</b>\n'
          + '1. Call the customer first\n'
          + '2. If reached, tap <b>\u{2705} Reached</b>\n'
          + '3. If no answer, tap <b>\u{1F4F5} No answer</b>\n'
          + '4. WhatsApp button appears \u{2014} send the message\n'
          + '5. Tap <b>\u{2705} Sent</b> when done\n'
          + '6. Tap <b>\u{1F6AB}</b> if they say don\'t contact me\n\n'
          + '<b>Commands:</b>\n'
          + '/pending \u{2014} contacts called but not WhatsApp\'d yet\n'
          + '/dnc \u{2014} do-not-contact list\n'
          + '/stats \u{2014} today\'s outreach summary\n'
          + '/leaderboard \u{2014} staff performance\n',
        );

      } else if (cmd === '/pending') {
        const [pending, totalPending] = await Promise.all([
          prisma.outreachContact.findMany({
            where: { method: 'pending' },
            include: { user: { select: { name: true, phone: true } } },
            orderBy: { contactedAt: 'desc' },
            take: 100,
          }),
          prisma.outreachContact.count({ where: { method: 'pending' } }),
        ]);
        if (!pending.length) {
          await send('No pending contacts. All caught up!');
        } else {
          const lines = pending.map((c, i) => {
            const name = c.user?.name || '(no name)';
            const phone = c.user?.phone?.replace('+', '') || 'no phone';
            const by = staffName(c.contactedBy);
            return `${i + 1}. <b>${name}</b> \u{2014} ${phone} (${c.touchType}, ${by})`;
          });
          const header = `<b>${totalPending} pending</b> (called, no answer)\n`;
          await sendChunked(send, header, lines);
        }

      } else if (cmd === '/dnc') {
        const [dnc, totalDnc] = await Promise.all([
          prisma.user.findMany({
            where: { outreachOptedOutAt: { not: null } },
            select: { name: true, outreachOptedOutAt: true },
            orderBy: { outreachOptedOutAt: 'desc' },
            take: 100,
          }),
          prisma.user.count({ where: { outreachOptedOutAt: { not: null } } }),
        ]);
        if (!dnc.length) {
          await send('No one on the DNC list.');
        } else {
          const lines = dnc.map((u, i) => {
            const name = u.name || '(no name)';
            const date = u.outreachOptedOutAt.toISOString().slice(0, 10);
            return `${i + 1}. <b>${name}</b> \u{2014} since ${date}`;
          });
          const header = `<b>${totalDnc} on Do Not Contact list</b>\n`;
          await sendChunked(send, header, lines);
        }

      } else if (cmd === '/stats') {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const contacts = await prisma.outreachContact.findMany({
          where: { contactedAt: { gte: todayStart } },
          select: { method: true, contactedBy: true, touchType: true },
        });
        const total = contacts.length;
        const calls = contacts.filter(c => c.method === 'call').length;
        const pending = contacts.filter(c => c.method === 'pending').length;
        const whatsapp = contacts.filter(c => c.method === 'whatsapp').length;
        const byStaff = {};
        contacts.forEach(c => {
          const name = staffName(c.contactedBy);
          byStaff[name] = (byStaff[name] || 0) + 1;
        });
        const staffLines = Object.entries(byStaff).map(([name, count]) => `  ${name}: ${count}`).join('\n');
        await send(
          `<b>Today's outreach</b>\n\n`
          + `Total: <b>${total}</b>\n`
          + `Reached by call: <b>${calls}</b>\n`
          + `Called, pending WA: <b>${pending}</b>\n`
          + `WhatsApp sent: <b>${whatsapp}</b>\n\n`
          + `<b>By staff:</b>\n${staffLines || '  (none yet)'}`,
        );

      } else if (cmd === '/leaderboard') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const contacts = await prisma.outreachContact.findMany({
          where: { contactedAt: { gte: thirtyDaysAgo } },
          select: { contactedBy: true, method: true },
        });
        const board = {};
        contacts.forEach(c => {
          const name = staffName(c.contactedBy);
          if (!board[name]) board[name] = { total: 0, call: 0, whatsapp: 0 };
          board[name].total++;
          if (c.method === 'call') board[name].call++;
          if (c.method === 'whatsapp') board[name].whatsapp++;
        });
        const sorted = Object.entries(board).sort((a, b) => b[1].total - a[1].total);
        if (!sorted.length) {
          await send('No outreach activity in the last 30 days.');
        } else {
          const lines = sorted.map(([name, s], i) => {
            return `${i + 1}. <b>${name}</b> \u{2014} ${s.total} total (${s.call} calls, ${s.whatsapp} WA)`;
          });
          await send(`<b>Leaderboard (30 days)</b>\n\n${lines.join('\n')}`);
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
