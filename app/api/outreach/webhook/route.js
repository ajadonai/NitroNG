import prisma from '@/lib/prisma';
import { OUTREACH_TOPIC_TO_TOUCH, outreachWhatsAppMessage } from '@/lib/telegram';

const TOKEN = process.env.OUTREACH_BOT_TOKEN;
const SECRET = process.env.CRON_SECRET;
const SITE = 'https://nitro.ng';

const OUTREACH_STAFF = ['8567146346', '8911494544'];
const STAFF_NAMES = { '8567146346': 'Nitro', '1935066216': 'Soludo', '8911494544': 'Eshiema' };

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

function parseName(msg) {
  const match = msg?.text?.match(/\d+\.\s*(.+)/);
  return match?.[1]?.split('\n')[0]?.trim() || 'User';
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
        const existing = await prisma.outreachContact.findFirst({
          where: { userId, touchType },
        });
        if (existing) {
          await tg('answerCallbackQuery', {
            callback_query_id: id,
            text: `Already handled by ${staffName(existing.contactedBy)}`,
            show_alert: true,
          });
          return Response.json({ ok: true });
        }
        await prisma.outreachContact.create({
          data: { userId, touchType, contactedBy: String(tgUserId), method: 'call' },
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
        const existing = await prisma.outreachContact.findFirst({
          where: { userId, touchType },
        });
        if (existing) {
          await tg('answerCallbackQuery', {
            callback_query_id: id,
            text: `Already handled by ${staffName(existing.contactedBy)}`,
            show_alert: true,
          });
          return Response.json({ ok: true });
        }
        await prisma.outreachContact.create({
          data: { userId, touchType, contactedBy: String(tgUserId), method: 'pending' },
        });
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
          `<b>${userName}</b> \u{2014} no answer (${clicker})`,
          { inline_keyboard: buttons },
        );
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'No answer. Send WhatsApp now.' });

      } else if (data.startsWith('ws:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        await prisma.outreachContact.updateMany({
          where: { userId, touchType, method: 'pending' },
          data: { method: 'whatsapp' },
        });
        const wsName = parseName(message);
        await editMsg(message.chat.id, message.message_id, `\u{2705} <b>${wsName}</b> \u{2014} WA by ${clicker}`);
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'WhatsApp sent! Done.' });

      } else if (data.startsWith('dnc:')) {
        const userId = data.slice(4);
        await prisma.user.update({ where: { id: userId }, data: { outreachOptedOutAt: new Date() } });
        const dncName = parseName(message);
        await editMsg(message.chat.id, message.message_id, `\u{1F6AB} <b>${dncName}</b> \u{2014} Do not contact`, { inline_keyboard: [] });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as Do Not Contact' });

      } else if (data.startsWith('wn:')) {
        const userId = data.slice(3);
        const touchType = OUTREACH_TOPIC_TO_TOUCH[threadId] || 'unknown';
        const existing = await prisma.outreachContact.findFirst({
          where: { userId, touchType },
        });
        if (existing) {
          await tg('answerCallbackQuery', {
            callback_query_id: id,
            text: `Already handled by ${staffName(existing.contactedBy)}`,
            show_alert: true,
          });
          return Response.json({ ok: true });
        }
        await prisma.outreachContact.create({
          data: { userId, touchType, contactedBy: String(tgUserId), method: 'wrong_number' },
        });
        await prisma.user.update({ where: { id: userId }, data: { phone: null } });
        const wnName = parseName(message);
        await editMsg(message.chat.id, message.message_id, `\u{274C} <b>${wnName}</b> \u{2014} wrong number (${clicker})`);
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as wrong number. Phone cleared.' });

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
