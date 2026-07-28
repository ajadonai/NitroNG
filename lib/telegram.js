const TOKEN = process.env.TG_BOT_TOKEN;
const CHAT  = process.env.TG_CHAT_ID;
const API   = `https://api.telegram.org/bot${TOKEN}`;

const TOPICS = { revenue: 2, orders: 3, users: 4, system: 5, timeout: 229, pulse: 101, refunds: 2857 };
const PROVIDER_NAMES = { mtp: 'MTP', daosmm: 'DaoSMM' };

function send(topic, text, extra) {
  if (!TOKEN || !CHAT) return Promise.resolve();
  return fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_thread_id: TOPICS[topic], text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  }).catch(() => {});
}

function line(label, value) { return `${label}: <b>${value}</b>`; }
function id(val) { return `<code>${val}</code>`; }
function naira(kobo) { return `₦${(kobo / 100).toLocaleString()}`; }
function mask(val) {
  if (!val) return '';
  if (!val.includes('@')) return val;
  const [local, domain] = val.split('@');
  if (local.length <= 2) return local[0] + '***@' + domain;
  return local[0] + '***' + local.slice(-1) + '@' + domain;
}

// ── Users ──────────────────────────────────────────────
export function tgNewUser(name, email, source) {
  send('users', `👤 <b>${name}</b>\n${mask(email)}${source ? `\n${source}` : ''}`);
}

export function tgUserDeletionRequested(userId, orderCount, totalSpent) {
  send('users', `🗑 <b>Deletion</b>\n${id(userId)}\n${orderCount} orders · ${naira(totalSpent)}`);
}

// ── Revenue ────────────────────────────────────────────
export function tgPayment(name, amountKobo, bonusKobo, channel, approvedBy) {
  let text = `💰 <b>${naira(amountKobo)}</b> deposit\n${mask(name)}`;
  if (bonusKobo) text += `\n+${naira(bonusKobo)} bonus`;
  if (channel) text += `\n${channel}`;
  if (approvedBy) text += `\n${approvedBy}`;
  return send('revenue', text);
}

export function tgManualPending(txId, name, email, amountKobo, senderRef) {
  let text = `💳 <b>${naira(amountKobo)}</b> manual deposit\n${name}\n${mask(email)}`;
  if (senderRef) text += `\nSender: ${senderRef}`;
  send('revenue', text,
    { reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: `approve:${txId}` },
      { text: '❌ Reject', callback_data: `reject:${txId}` },
    ]] } },
  );
}

export function tgRefund(orderId, amountKobo, reason) {
  send('revenue', `💸 <b>${naira(amountKobo)}</b> refund\n${id(orderId)}${reason ? `\n${reason}` : ''}`);
}

export function tgRefundAlert({ orderId, amount, charge, qty, remains, status, reason, user, service, source }) {
  const pct = charge > 0 ? Math.round((amount / charge) * 100) : 100;
  const emoji = status === 'Partial' ? '⚠️' : '🔴';
  const lines = [`${emoji} <b>${naira(amount)}</b> ${status === 'Partial' ? 'partial ' : ''}refund`, id(orderId) + ` (${pct}%)`];
  if (service) lines.push(service.length > 45 ? service.slice(0, 42) + '...' : service);
  if (user) lines.push(mask(user));
  if (qty) lines.push(`${qty.toLocaleString()} qty${remains ? ` · ${remains.toLocaleString()} left` : ''}`);
  if (reason) lines.push(reason);
  if (source) lines.push(source);
  send('refunds', lines.join('\n'));
}

// ── Orders ─────────────────────────────────────────────
export function tgNewOrder(orderId, serviceName, qty, chargeKobo, userName, link, platform) {
  const svc = serviceName.length > 50 ? serviceName.slice(0, 47) + '...' : serviceName;
  const label = (platform || 'Link').charAt(0).toUpperCase() + (platform || 'link').slice(1);
  const linkLine = link ? `\n🔗 <a href="${link}">${label}</a>` : '';
  send('orders', `📦 <b>${id(orderId)}</b> · ${naira(chargeKobo)}\n${svc}\n${qty.toLocaleString()} × ${mask(userName)}${linkLine}`);
}

export function tgOrderCancelled(orderId, amountKobo, reason) {
  send('orders', `❌ <b>${id(orderId)}</b> cancelled\n${naira(amountKobo)} refunded${reason ? `\n${reason}` : ''}`);
}

// ── Fraud / Risk ──────────────────────────────────────
export function tgBonusWithheld(name, email, ip, priorClaims, windowDays, depositKobo, bonusKobo) {
  return send('system', `⚠️ <b>${naira(bonusKobo)} bonus withheld</b>\n${mask(name)}\n${mask(email)}\n${naira(depositKobo)} deposit\n${priorClaims} claims in ${windowDays}d\nIP ${ip}`);
}

// ── Admin actions ─────────────────────────────────────
export function tgAdminCredit(adminName, userName, userEmail, amountKobo, type) {
  const label = type === 'gift' ? 'Gift' : 'Credit';
  send('system', `🏦 <b>Admin ${label}</b>\n${naira(amountKobo)} → ${mask(userName)}\n${mask(userEmail)}\nby ${adminName}`);
}

// ── System ─────────────────────────────────────────────
export function tgProviderBalance(alerts) {
  const rows = alerts.map(a => `  ${a.provider}: <b>$${a.balance.toFixed(2)}</b> (min $${a.threshold})`).join('\n');
  send('system', `⚠️ <b>Low Provider Balance</b>\n${rows}`);
}

export function tgFxUpdate(oldRate, newRate, market, buffer) {
  send('system', `📈 <b>₦${oldRate} → ₦${newRate}</b>\nMarket ₦${market} + ₦${buffer}`);
}

export function tgDripTimeout(orderId, batch, detail, apiOrderId, provider) {
  const providerTag = provider ? `\n${PROVIDER_NAMES[provider] || provider}` : '';
  let text = `⏱ <b>${id(orderId)}</b> batch ${batch}${providerTag}`;
  if (apiOrderId) text += `\n${id(apiOrderId)}`;
  text += `\n${detail || 'Check provider dashboard.'}`;
  send('timeout', text);
}

export function tgDispatchFailed(orderId, error) {
  send('orders', `🔴 <b>${id(orderId)}</b> failed\n${error}`);
}

export function tgDailySummary(stats) {
  const rows = Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `  ${k}: <b>${v}</b>`).join('\n');
  send('system', `📊 <b>Daily Summary</b>\n${rows}`);
}

export function tgDigest(date, time, s) {
  send('pulse', [
    `📊 <b>Pulse — ${date}, ${time} WAT</b>`,
    '',
    '<b>Today</b>',
    `  💰 Revenue: <b>${s.revenue}</b>${s.revenuePct}`,
    `  📈 Profit: <b>${s.profit}</b> (${s.margin} markup)`,
    `  🏦 Money in: <b>${s.deposits}</b>${s.depositsPct}`,
    `  📦 Orders: <b>${s.orders}</b>${s.ordersPct} (${s.processing} processing)`,
    `  👤 New users: <b>${s.newUsers}</b> (${s.totalUsers.toLocaleString()} total)`,
    '',
    '<b>Month to date</b>',
    `  💰 Revenue: <b>${s.monthRevenue}</b>`,
    `  📈 Profit: <b>${s.monthProfit}</b> (${s.monthMargin} markup)`,
    `  🏦 Money in: <b>${s.monthDeposits}</b>`,
    `  📦 Orders: <b>${s.monthOrders}</b>`,
  ].join('\n'));
}

// ── Callback handler helpers (for webhook) ─────────────
export function tgAnswerCallback(callbackId, text) {
  if (!TOKEN) return Promise.resolve();
  return fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  }).catch(() => {});
}

export function tgEditMessage(messageId, text, extra = {}) {
  if (!TOKEN || !CHAT) return Promise.resolve();
  return fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_id: messageId, text, parse_mode: 'HTML', ...extra }),
  }).catch(() => {});
}

export function tgDeleteMessage(messageId) {
  if (!TOKEN || !CHAT) return Promise.resolve();
  return fetch(`${API}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_id: messageId }),
  }).catch(() => {});
}

// ── Outreach (separate bot — sensitive data) ─────────
const OUTREACH_TOKEN = process.env.OUTREACH_BOT_TOKEN;
const OUTREACH_CHAT  = process.env.OUTREACH_CHAT_ID;
const OUTREACH_TOPICS = { day1: 8, day3: 9, day7: 10, winback: 11, firstDeposit: 13, firstOrder: 14 };
const OUTREACH_BATCH = 15;
const SITE = 'https://nitro.ng';

const OUTREACH_MESSAGES = {
  day1: (name) =>
    `Hi ${name}, Ify from Nitro \u{1F44B}\n\n`
    + `I saw you signed up yesterday. I am the one who helps new people find their way around, so anything you need, just ask me.\n\n`
    + `One question so I can point you the right way. What do you want people to see first? Your page, one post, or something you are dropping soon?\n\n`
    + `Tell me and I will show you where to start. You can start with \u{20A6}1,000, and your first deposit from \u{20A6}2,500 comes with up to \u{20A6}3,000 free to spend.\n\n`
    + `\u{1F449} ${SITE}/dashboard?page=add-funds`,
  day3: (name) =>
    `Hi ${name}, Ify again \u{1F44B}\n\n`
    + `Let me show you how it works. It takes about a minute.\n\n`
    + `1. Open your dashboard and add funds. Card, transfer or crypto, from \u{20A6}1,000.\n`
    + `2. Choose the platform, then paste the link to your page or post.\n`
    + `3. Pick how fast you want it, place the order, then watch it move live on your dashboard.\n\n`
    + `Your money stays in your own wallet until you spend it. And if an order does not start, every kobo goes straight back to your wallet.\n\n`
    + `If you are not sure what to pick, send me your link and I will tell you what I would start with.\n\n`
    + `\u{1F449} ${SITE}/dashboard?page=add-funds`,
  day7: (name) =>
    `Hi ${name}, Ify one last time \u{1F44B}\n\n`
    + `I will not keep filling your phone, so this is my last message about getting started.\n\n`
    + `Your up to \u{20A6}3,000 first deposit credit is still there whenever you are ready, and you can still start with \u{20A6}1,000. Nothing is expiring today.\n\n`
    + `But if something stopped you, whether it is the price, not knowing what to choose, or you were not sure this thing is real, just reply and tell me. I would rather sort it out than keep messaging you.\n\n`
    + `\u{1F449} ${SITE}/dashboard?page=add-funds`,
  winback: (name, creditNaira) =>
    `Hi ${name}, Ify from Nitro \u{1F44B}\n\n`
    + `It has been about a month since your last order. Life happens. But your page did not pause with you, and the accounts you were catching up with are still pushing theirs.\n\n`
    + `So I put \u{20A6}${creditNaira.toLocaleString()} in free promo credit in your wallet to make coming back easy. It is there now, it works on anything, and it goes after 7 days.\n\n`
    + `You already know how it works. Pick the post that deserves better, use the credit on it, and watch it move.\n\n`
    + `\u{1F449} ${SITE}/dashboard`,
  firstDeposit: (name, amountNaira, bonusNaira, totalNaira) => {
    const bonusLine = bonusNaira && bonusNaira > 0
      ? `, and your \u{20A6}${bonusNaira.toLocaleString()} free credit is in there too, so you have \u{20A6}${totalNaira.toLocaleString()} to spend`
      : `. Top up to \u{20A6}2,500 whenever you are ready and I will add \u{20A6}500 free on top`;
    return `Hi ${name}, Ify here \u{1F44B}\n\n`
      + `Thank you, honestly. You did not have to do that. Plenty of people find a place like this and decide to watch from far, so putting your own money in means you took a chance on us. I do not take that lightly.\n\n`
      + `Your \u{20A6}${amountNaira.toLocaleString()} is in your wallet${bonusLine}.\n\n`
      + `So let us use it well. If you already know what you are pushing, go ahead, you do not need me for that. If you are still thinking about it, send me the link and I will tell you exactly what I would put behind it.\n\n`
      + `Either way, I am here.\n\n`
      + `\u{1F449} ${SITE}/dashboard`;
  },
  firstOrder: (name) =>
    `Hi ${name}, Ify here \u{1F44B}\n\n`
    + `Your first order is in, and I am happy you went for it.\n\n`
    + `One thing I tell everybody at this point. It will not all land at once, and that is deliberate. It comes in gradually so everything looks natural, and that slow build is the part that keeps your account safe. Some things start in minutes, others take a while to warm up.\n\n`
    + `You can follow it live on your dashboard from start to finish, so you are never guessing. And if it does not start, every kobo goes back to your wallet.\n\n`
    + `So nothing else for you to do now. Let it work. I will come back to you when it is done.\n\n`
    + `\u{1F449} ${SITE}/dashboard`,
};

function sendOutreach(text, topicId, replyMarkup) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT) return Promise.resolve();
  const body = {
    chat_id: OUTREACH_CHAT,
    message_thread_id: topicId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return fetch(`https://api.telegram.org/bot${OUTREACH_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function tgOutreach(users, touchKey, { label, creditMap } = {}) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT || !users.length) return;
  const topicId = OUTREACH_TOPICS[touchKey];
  if (!topicId) return;
  const sep = '\u{2500}'.repeat(30);
  const total = users.length;
  const pages = Math.ceil(total / OUTREACH_BATCH);

  for (let p = 0; p < pages; p++) {
    const chunk = users.slice(p * OUTREACH_BATCH, (p + 1) * OUTREACH_BATCH);
    const startIdx = p * OUTREACH_BATCH + 1;
    const lines = [];
    const buttons = [];

    chunk.forEach((u, i) => {
      const idx = startIdx + i;
      const name = u.name || '';
      const displayName = name || '(no name)';
      const phone = u.phone?.replace('+', '') || '';

      if (!phone) {
        lines.push(`${idx}. ${displayName} \u{2014} \u{26A0}\u{FE0F} no phone`);
        return;
      }

      lines.push(`${idx}. <b>${displayName}</b>`);
      const credit = creditMap?.get?.(u.id);
      const waName = name || 'Hi \u{1F44B}';
      const msgFn = OUTREACH_MESSAGES[touchKey];
      const waText = encodeURIComponent(msgFn(waName, credit));
      const waUrl = `https://wa.me/${phone}?text=${waText}`;
      const short = displayName.length > 20 ? displayName.slice(0, 18) + '..' : displayName;
      buttons.push([
        { text: `\u{1F4AC} ${idx}. ${short}`, url: waUrl },
        { text: '\u{2705}', callback_data: `s:${i}` },
      ]);
    });

    const pageLabel = pages > 1 ? ` (${p + 1}/${pages})` : '';
    const heading = label || touchKey;
    const header = p === 0
      ? `\u{1F4CB}  <b>${total} ${heading}</b>${pageLabel}`
      : `\u{1F4CB}  <b>${heading} continued</b>${pageLabel}`;
    const footer = p === pages - 1
      ? `\n\n${sep}\n\u{26A0}\u{FE0F} <i>Send 15\u{2013}20 per hour to avoid WhatsApp flagging.</i>`
      : '';
    const text = `${header}\n${sep}\n\n${lines.join('\n')}${footer}`;
    const replyMarkup = buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
    await sendOutreach(text, topicId, replyMarkup);
  }
}

export async function tgOutreachAlert(user, type, extra = {}) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT) return;
  const topicId = OUTREACH_TOPICS[type];
  if (!topicId) return;
  const name = user.name || user.email || '(unknown)';
  const waName = user.name || '';
  const phone = user.phone?.replace('+', '') || '';

  if (type === 'firstDeposit') {
    const amt = extra.amount || 0;
    const bonus = extra.bonus || 0;
    const total = amt + bonus;
    const amtStr = amt ? ` \u{2014} \u{20A6}${Number(amt).toLocaleString()}` : '';
    const text = `\u{1F4B0} <b>First deposit!</b>\n\n<b>${name}</b>${amtStr}\n\nSigned up: ${fmtDate(user.createdAt)}`;
    const buttons = [];
    if (phone) {
      const waText = encodeURIComponent(OUTREACH_MESSAGES.firstDeposit(waName || 'Hi \u{1F44B}', amt, bonus, total));
      buttons.push([{ text: '\u{1F4AC} Send WhatsApp', url: `https://wa.me/${phone}?text=${waText}` }]);
      buttons.push([{ text: '\u{2705} Mark as sent', callback_data: 'sent' }]);
    }
    await sendOutreach(text, topicId, buttons.length ? { inline_keyboard: buttons } : undefined);
  } else if (type === 'firstOrder') {
    const svc = extra.serviceName || '';
    const text = `\u{1F6D2} <b>First order!</b>\n\n<b>${name}</b>${svc ? ` \u{2014} ${svc}` : ''}\n\nSigned up: ${fmtDate(user.createdAt)}`;
    const buttons = [];
    if (phone) {
      const waText = encodeURIComponent(OUTREACH_MESSAGES.firstOrder(waName || 'Hi \u{1F44B}'));
      buttons.push([{ text: '\u{1F4AC} Send WhatsApp', url: `https://wa.me/${phone}?text=${waText}` }]);
      buttons.push([{ text: '\u{2705} Mark as sent', callback_data: 'sent' }]);
    }
    await sendOutreach(text, topicId, buttons.length ? { inline_keyboard: buttons } : undefined);
  }
}

function fmtDate(d) {
  if (!d) return 'unknown';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
