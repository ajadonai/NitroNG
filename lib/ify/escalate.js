// lib/ify/escalate.js
// Hand off to a human: alert the team on Telegram, drop an in-app ticket (if we know the user),
// and return the message to show the customer. The caller pauses the bot for this chat.

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT = process.env.TG_CHAT_ID;
const TG_TOPIC = process.env.IFY_TG_TOPIC ? Number(process.env.IFY_TG_TOPIC) : undefined;

function trim(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function maskEmail(v) {
  if (!v || !v.includes('@')) return v || '';
  const [l, d] = v.split('@');
  return (l[0] || '') + '***@' + d;
}
function makeTicketId() {
  return (
    'IFY-' +
    Date.now().toString(36).toUpperCase().slice(-4) +
    '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

async function tgAlert(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        message_thread_id: TG_TOPIC,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch {
    /* best-effort */
  }
}

// Returns the customer-facing handoff message.
export async function escalate({ from, name, user, message, reason, history }) {
  const who = user ? `${user.name} (${maskEmail(user.email)})` : name || 'Unknown';
  const waLink = `https://wa.me/${(from || '').replace(/\D/g, '')}`;
  const recent = (history || [])
    .slice(-4)
    .map((m) => `${m.role === 'user' ? '👤' : '🤖'} ${trim(m.content, 140)}`)
    .join('\n');

  // 1) Ping the team
  await tgAlert(
    `🆘 <b>Ify needs a human</b>\n` +
      `From: <b>${who}</b>${user ? '' : ' — <i>no account</i>'}\n` +
      `WhatsApp: <a href="${waLink}">${from}</a>\n` +
      `Reason: ${trim(reason, 120) || '—'}\n` +
      `Message: <i>${trim(message, 240)}</i>` +
      (recent ? `\n—\n${recent}` : ''),
  );

  // 2) Track it in-app as a ticket (only possible when we know the user — userId is required)
  if (user?.id) {
    try {
      await prisma.ticket.create({
        data: {
          ticketId: makeTicketId(),
          userId: user.id,
          subject: 'WhatsApp support (via Ify)',
          message: `[via Ify / WhatsApp] ${message}`.slice(0, 1000),
          status: 'Open',
          unreadByAdmin: true,
        },
      });
    } catch (e) {
      log.warn('Ify', `ticket create failed: ${e.message}`);
    }
  }

  // 3) What the customer sees
  return user
    ? `Thanks${user.firstName ? ' ' + user.firstName : ''} — I've flagged this to a Nitro teammate and someone will reply right here shortly. 🙏`
    : `Thanks for reaching out! A Nitro teammate will follow up here shortly. If you have a Nitro account, replying with the email you signed up with helps us find you faster.`;
}
