import prisma from '@/lib/prisma';

const TOKEN = process.env.OUTREACH_BOT_TOKEN;
const SECRET = process.env.CRON_SECRET;

const TOPIC_TO_TOUCH = { 8: 'day1', 9: 'day3', 10: 'day7', 11: 'winback', 13: 'firstDeposit', 14: 'firstOrder' };

function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function recordContact(userId, threadId, tgUserId) {
  const touchType = TOPIC_TO_TOUCH[threadId] || 'unknown';
  try {
    await prisma.outreachContact.create({
      data: { userId, touchType, contactedBy: tgUserId ? String(tgUserId) : null },
    });
  } catch {}
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

      if (data === 'sent') {
        // Legacy single-alert checkmark (no user ID embedded)
        await tg('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: [[{ text: '\u{2705} Sent', callback_data: 'n' }]] },
        });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as sent!' });
      } else if (data.startsWith('c:')) {
        const userId = data.slice(2);
        await recordContact(userId, threadId, tgUserId);
        await tg('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: [[{ text: '\u{2705} Sent', callback_data: 'n' }]] },
        });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as sent!' });
      } else if (data.startsWith('s:')) {
        const userId = data.slice(2);
        if (userId.length > 5) await recordContact(userId, threadId, tgUserId);
        const kb = message.reply_markup?.inline_keyboard || [];
        const newKb = kb.map(row => {
          const cb = row.find(b => b.callback_data === data);
          if (!cb) return row;
          const urlBtn = row.find(b => b.url);
          const label = urlBtn?.text?.replace(/^\u{1F4AC}\s*/u, '') || 'User';
          return [{ text: `\u{2705} ${label}`, callback_data: 'n' }];
        });
        await tg('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: newKb },
        });
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Marked as sent!' });
      } else if (data === 'n') {
        await tg('answerCallbackQuery', { callback_query_id: id, text: 'Already marked as sent' });
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
            + '3. Tap <b>\u{2705}</b> to mark it as sent\n\n'
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
