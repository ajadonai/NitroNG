import prisma from '@/lib/prisma';

const TOKEN = process.env.OUTREACH_BOT_TOKEN;
const SECRET = process.env.CRON_SECRET;

const TOPIC_TO_TOUCH = { 8: 'day1', 9: 'day3', 10: 'day7', 11: 'winback', 13: 'firstDeposit', 14: 'firstOrder' };

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

async function claimContact(userId, threadId, tgUserId) {
  const touchType = TOPIC_TO_TOUCH[threadId] || 'unknown';
  const existing = await prisma.outreachContact.findFirst({
    where: { userId, touchType },
    select: { contactedBy: true },
  });
  if (existing) return { claimed: false, by: existing.contactedBy };
  await prisma.outreachContact.create({
    data: { userId, touchType, contactedBy: tgUserId ? String(tgUserId) : null },
  });
  return { claimed: true };
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
          text: 'You don’t have access to outreach actions.',
          show_alert: true,
        });
        return Response.json({ ok: true });
      }

      if (data === 'sent') {
        await tg('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: [[{ text: `\u{2705} ${clicker}`, callback_data: 'n' }]] },
        });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as sent!' });
      } else if (data.startsWith('c:')) {
        const userId = data.slice(2);
        const result = await claimContact(userId, threadId, tgUserId);
        if (!result.claimed) {
          await tg('answerCallbackQuery', {
            callback_query_id: id,
            text: `Already contacted by ${staffName(result.by)}`,
            show_alert: true,
          });
          return Response.json({ ok: true });
        }
        await tg('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: [[{ text: `\u{2705} ${clicker}`, callback_data: 'n' }]] },
        });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as sent!' });
      } else if (data.startsWith('s:')) {
        const userId = data.slice(2);
        let blocked = false;
        if (userId.length > 5) {
          const result = await claimContact(userId, threadId, tgUserId);
          if (!result.claimed) {
            await tg('answerCallbackQuery', {
              callback_query_id: id,
              text: `Already contacted by ${staffName(result.by)}`,
              show_alert: true,
            });
            blocked = true;
          }
        }
        if (!blocked) {
          const kb = message.reply_markup?.inline_keyboard || [];
          const newKb = kb.map(row => {
            const cb = row.find(b => b.callback_data === data);
            if (!cb) return row;
            const urlBtn = row.find(b => b.url);
            const label = urlBtn?.text?.replace(/^\u{1F4AC}\s*/u, '') || 'User';
            return [{ text: `\u{2705} ${label} \u{2014} ${clicker}`, callback_data: 'n' }];
          });
          await tg('editMessageReplyMarkup', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: { inline_keyboard: newKb },
          });
          await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as sent!' });
        }
      } else if (data.startsWith('dnc:')) {
        const userId = data.slice(4);
        if (!OUTREACH_STAFF.includes(String(tgUserId))) {
          await tg('answerCallbackQuery', { callback_query_id: id, text: 'You don’t have access to outreach actions.', show_alert: true });
          return Response.json({ ok: true });
        }
        await prisma.user.update({ where: { id: userId }, data: { outreachOptedOutAt: new Date() } });
        const kb = message.reply_markup?.inline_keyboard || [];
        const newKb = kb.map(row => {
          const dncBtn = row.find(b => b.callback_data === data);
          if (!dncBtn) return row;
          const urlBtn = row.find(b => b.url);
          const label = urlBtn?.text?.replace(/^\u{1F4AC}\s*/u, '') || 'User';
          return [{ text: `\u{1F6AB} ${label} \u{2014} DNC`, callback_data: 'n' }];
        });
        await tg('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: newKb },
        });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as Do Not Contact' });
      } else if (data === 'n') {
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Already handled' });
      }
    }

    if (body.message?.text?.startsWith('/')) {
      const cmd = body.message.text.split(/\s/)[0].replace(/@\w+$/, '');
      const chatId = body.message.chat.id;
      const threadId = body.message.message_thread_id;

      if (cmd === '/start' || cmd === '/help') {
        await tg('sendMessage', {
          chat_id: chatId,
          ...(threadId ? { message_thread_id: threadId } : {}),
          text: '\u{1F4CB} <b>Nitro Outreach Bot</b>\n\n'
            + 'I post outreach leads here automatically every day.\n\n'
            + '<b>How it works:</b>\n'
            + '1. Tap <b>\u{1F4AC} Send WhatsApp</b> to open WhatsApp with Ify\'s message pre-filled\n'
            + '2. Send the message\n'
            + '3. Tap <b>\u{2705}</b> to mark it as sent\n'
            + '4. Tap <b>\u{1F6AB}</b> if the customer says don\'t contact them\n\n'
            + '<b>Topics:</b>\n'
            + '\u{2022} <b>Day 1</b> \u{2014} signed up yesterday, no deposit\n'
            + '\u{2022} <b>Day 3</b> \u{2014} 3 days in, still no deposit\n'
            + '\u{2022} <b>Day 7</b> \u{2014} last chance before sequence ends\n'
            + '\u{2022} <b>Winback</b> \u{2014} inactive 30 days, has promo credit\n'
            + '\u{2022} <b>First Deposit</b> \u{2014} just funded, nudge to first order\n'
            + '\u{2022} <b>First Order</b> \u{2014} just ordered, explain what to expect\n\n'
            + '\u{26A0}\u{FE0F} <i>Send 15\u{2013}20 WhatsApp messages per hour to avoid flagging.</i>',
          parse_mode: 'HTML',
        });
      }
    }
  } catch {}

  return Response.json({ ok: true });
}
