// lib/ify/outreach.js
// The connector Claude Code's triggers call. ONE function: sendOutreach({ user, trigger, extra }).
// It sends the pre-approved WhatsApp template for that trigger, stamps the tracking column so the
// daily cron won't resend, and opens the AI-handled window so replies route to the bot.
//
// Business-initiated messages MUST use approved templates (free text is only allowed as a reply
// inside the 24h window). The template NAMES are in config; their approved copy must mirror
// OUTREACH_MESSAGES in lib/telegram.js. Variable ORDER below must match the template's {{1}},{{2}}…

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { IFY, isAllowed } from './config';
import { sendTemplate } from './whatsapp';
import { setMode, resetTurns, logExchange } from './store';

const firstName = (n) => String(n || 'there').trim().split(/\s+/)[0];
const naira = (v) => (v == null || v === '' ? '' : '₦' + Number(v).toLocaleString('en-US'));

// trigger -> { column: users column to stamp (null = fires once, tracked elsewhere),
//              vars: (user, extra) => ordered template body params }
const TRIGGERS = {
  day1:         { column: 'outreachDay1SentAt',    vars: (u) => [firstName(u.name)] },
  day3:         { column: 'outreachDay3SentAt',    vars: (u) => [firstName(u.name)] },
  day7:         { column: 'outreachDay7SentAt',    vars: (u) => [firstName(u.name)] },
  firstDeposit: { column: null,                    vars: (u, e) => [firstName(u.name), naira(e?.amount), naira(e?.bonus)] },
  firstOrder:   { column: null,                    vars: (u, e) => [firstName(u.name), e?.serviceName || 'your order'] },
  winback:      { column: 'outreachWinbackSentAt', vars: (u, e) => [firstName(u.name), naira(e?.creditNaira)] },
};

export async function sendOutreach({ user, trigger, extra }) {
  // Checked before anything else. The outreach cron calls this for every contact
  // in every batch, so while the bot is off a later guard would log a warning per
  // contact — hundreds a day of noise about a decision already taken.
  if (!IFY.enabled) return { ok: false, reason: 'disabled' };

  const cfg = TRIGGERS[trigger];
  const template = IFY.outreach.templates[trigger];
  if (!cfg || !template) { log.warn('Ify', `unknown outreach trigger: ${trigger}`); return { ok: false, reason: 'unknown trigger' }; }
  if (!user?.phone) return { ok: false, reason: 'no phone' };
  if (!isAllowed(user.phone)) return { ok: false, reason: 'not in allowlist' };

  const ok = await sendTemplate(user.phone, template, IFY.outreach.langCode, cfg.vars(user, extra));
  if (!ok) return { ok: false, reason: 'send failed' };

  // Stamp the tracking column (cron-based triggers) so it isn't resent.
  if (cfg.column && user.id) {
    try {
      await prisma.user.update({ where: { id: user.id }, data: { [cfg.column]: new Date() } });
    } catch (e) {
      log.warn('Ify', `stamp ${cfg.column} failed: ${e.message}`);
    }
  }

  // A fresh outbound starts a bot-handled conversation.
  await setMode(user.phone, 'ai');
  await resetTurns(user.phone);
  await logExchange({ phone: user.phone, name: user.name, userId: user.id || null, inbound: `[outreach:${trigger}]`, reply: `[template:${template}]`, action: 'outreach', reason: trigger });

  return { ok: true, template };
}
