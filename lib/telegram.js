import { proofToLink } from './proof-link.js';
import { log } from './logger.js';
import { formatKobo as naira } from './money.js';

const TOKEN = process.env.TG_BOT_TOKEN;
const CHAT  = process.env.TG_CHAT_ID;
const API   = `https://api.telegram.org/bot${TOKEN}`;

const TOPICS = { revenue: 2, orders: 3, users: 4, system: 5, timeout: 229, pulse: 101, refunds: 2857, tasks: 11355 };

/**
 * Every alert this file sends is in flight here until it lands.
 *
 * A serverless handler that fires an alert and returns immediately can be
 * frozen before the request to Telegram flushes, and the alert is simply lost —
 * silently, because the failure has nowhere to appear. That is how a partial
 * refund on NTR-8722 credited the wallet correctly and told nobody. Handlers
 * now `await tgFlush()` before returning, which waits for whatever is still
 * outstanding.
 *
 * Failures are logged rather than swallowed. A wrong topic id or a rate limit
 * used to vanish into an empty catch, so the watchtower going quiet looked
 * exactly like nothing happening.
 */
const inFlight = new Set();

function send(topic, text, extra) {
  if (!TOKEN || !CHAT) return Promise.resolve();
  const p = fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_thread_id: TOPICS[topic], text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  })
    .then(async (r) => {
      if (!r.ok) log.warn('Telegram', `${topic} alert rejected: ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`);
      return r;
    })
    .catch((err) => { log.warn('Telegram', `${topic} alert failed: ${err.message}`); })
    .finally(() => inFlight.delete(p));
  inFlight.add(p);
  return p;
}

/** Wait for every alert still in flight. Call before a handler returns, or the
 *  platform may kill the request before Telegram ever hears from us. */
export function tgFlush() {
  return Promise.allSettled([...inFlight]);
}

function id(val) { return `<code>${val}</code>`; }

function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  const tens = v % 100;
  if (tens >= 11 && tens <= 13) return `${v}th`;
  return `${v}${({ 1: 'st', 2: 'nd', 3: 'rd' })[v % 10] || 'th'}`;
}

function mask(val) {
  if (!val) return '';
  if (!val.includes('@')) return val;
  const [local, domain] = val.split('@');
  if (local.length <= 2) return local[0] + '***@' + domain;
  return local[0] + '***' + local.slice(-1) + '@' + domain;
}

// ── Users ──────────────────────────────────────────────
const SIGNUP_SOURCE = Object.freeze({ google: 'Signed up through Google', direct: 'Signed up directly' });

export function tgNewUser(name, email, source) {
  // `google` alone on a line could be a name, a referrer or a payment method.
  const how = source ? (SIGNUP_SOURCE[String(source).toLowerCase()] || `Signed up through ${source}`) : null;
  return send('users', [`👤 <b>${name}</b>`, mask(email), how].filter(Boolean).join('\n'));
}

export function tgUserDeletionRequested(userId, orderCount, totalSpent) {
  // Deliberately no contact detail, not even masked: this is the one message
  // where naming the person is the thing they just asked us to stop doing.
  // tests/account-deletion-notices.test.js holds it to identifiers and totals.
  return send('users', [
    '🗑 Account deletion requested',
    `${orderCount} orders, ${naira(totalSpent)} spent`,
    id(userId),
  ].join('\n'));
}

// ── Revenue ────────────────────────────────────────────
export function tgPayment(name, amountKobo, bonusKobo, channel, approvedBy, depositNumber) {
  // (#3) beside the money read as a reference number; it is their third deposit.
  const lines = [`💰 <b>${naira(amountKobo)}</b> deposit`, mask(name)];
  if (depositNumber) lines.push(`Their ${ordinal(depositNumber)}`);
  if (bonusKobo) lines.push(`+${naira(bonusKobo)} welcome bonus`);
  if (channel) lines.push(channel);
  if (approvedBy) lines.push(`approved by ${approvedBy}`);
  return send('revenue', lines.join('\n'));
}

export function tgManualPending(txId, name, email, amountKobo, senderRef) {
  // The useful fact is that it needs somebody. The full name used to print
  // unmasked directly above the masked email, which undid the masking.
  const lines = [`💳 <b>${naira(amountKobo)}</b> waiting for approval`, mask(name), mask(email), 'Bank transfer'];
  if (senderRef) lines.push(`Sent by ${senderRef}`);
  const text = lines.join('\n');
  return send('revenue', text,
    { reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: `approve:${txId}` },
      { text: '❌ Reject', callback_data: `reject:${txId}` },
    ]] } },
  );
}

/**
 * What a refund reason is stored as, and what it should read as.
 *
 * The channel was getting the raw column: `wrong_platform_link`,
 * `admin_cancelled_duplicate`, `provider_partial`. Six of the nine reasons seen
 * in 90 days were snake_case, and the most common case of all — 601 of 692 —
 * carried no reason at all and printed an empty line.
 */
const REFUND_REASONS = Object.freeze({
  needs_post_link: 'Needed the link to the post, not the profile',
  needs_profile_link: 'Needed the link to the profile, not a post',
  wrong_platform_link: 'Link was for a different platform',
  user_cancelled: 'Cancelled by the customer',
  'user_cancelled (bulk)': 'Cancelled by the customer, whole batch',
  admin_cancelled: 'Cancelled by an admin',
  admin_cancelled_duplicate: 'Cancelled as a duplicate',
  provider_cancelled: 'Cancelled upstream',
  provider_partial: 'Stopped part way',
  dispatch_failed: 'Never got sent',
  recovered: 'Caught by the nightly sweep',
});

/** How we came to know, for the cases the reason does not already say. */
const REFUND_SOURCES = Object.freeze({
  auto: 'found by the status check',
  check: 'found by a status check',
});

export function refundReasonText(reason) {
  if (!reason) return 'Cancelled upstream';
  const raw = String(reason).trim();
  if (REFUND_REASONS[raw]) return REFUND_REASONS[raw];
  // `admin_cancelled: they used the wrong link` — keep the note, drop the code.
  const noted = raw.match(/^admin_cancelled:\s*(.+)$/);
  if (noted) {
    const note = noted[1].trim().replace(/\s+/g, ' ');
    return `Cancelled by an admin: ${note.charAt(0).toUpperCase()}${note.slice(1)}`;
  }
  // Anything else is upstream's own words. It arrives as a sentence already, so
  // it is left alone apart from the one shape that names them out loud.
  if (/^provider discontinued/i.test(raw)) return 'Service was discontinued upstream';
  return raw;
}

export function tgRefundAlert({ orderId, amount, charge, qty, remains, status, reason, user, service, source }) {
  const emoji = status === 'Partial' ? '⚠️' : '🔴';
  const reasonText = refundReasonText(reason);
  // One fact per line, so nothing wraps on a phone.
  const lines = [`${emoji} <b>${naira(amount)}</b> ${status === 'Partial' ? 'partial ' : ''}refund`, id(orderId)];
  if (user) lines.push(mask(user));
  if (service) lines.push(service.length > 45 ? service.slice(0, 42) + '...' : service);
  if (qty) lines.push(`${qty.toLocaleString()} qty${remains ? ` | ${remains.toLocaleString()} left` : ''}`);
  lines.push(reasonText);
  // An admin cancellation already names who and why, and `user_cancelled` says
  // where it came from, so the trailing line would only repeat them.
  const src = REFUND_SOURCES[source];
  if (src && !/^Cancelled by/.test(reasonText)) lines.push(src);
  return send('refunds', lines.join('\n'));
}

// ── Orders ─────────────────────────────────────────────
export function tgNewOrder(orderId, serviceName, qty, chargeKobo, userName, link) {
  // Same shape as a refund, so the two read as a pair in the feed. `20 × a
  // person` was the odd line out, and the link label said the platform, which
  // the service line already says.
  const svc = serviceName.length > 50 ? serviceName.slice(0, 47) + '...' : serviceName;
  return send('orders', [
    // The order number leads: it is what anybody reading the feed reaches for.
    `📦 ${id(orderId)} | <b>${naira(chargeKobo)}</b>`,
    mask(userName),
    svc,
    `${qty.toLocaleString()} qty`,
    link ? `🔗 <a href="${link}">Open the link</a>` : null,
  ].filter(Boolean).join('\n'));
}

// ── Fraud / Risk ──────────────────────────────────────
export function tgBonusWithheld(name, email, ip, priorClaims, windowDays, depositKobo, bonusKobo) {
  // "2 claims in 30d" never said claims by whom, which is the whole reason the
  // bonus was held.
  return send('system', [
    `⚠️ <b>${naira(bonusKobo)}</b> bonus withheld`,
    mask(name), mask(email),
    `${naira(depositKobo)} deposit`,
    `${priorClaims} other claims from this IP in ${windowDays} days`,
    ip,
  ].join('\n'));
}

// ── Admin actions ─────────────────────────────────────
/**
 * A free order gives away service that costs Nitro real provider money and
 * writes no ledger row, so nothing else in the system says it happened. The
 * only one ever created went unnoticed until someone opened the order by hand.
 */
export function tgFreeOrder({ orderRef, adminName, userName, valueKobo, costKobo, service, quantity, reason, count }) {
  // The money is the point and it was on line three behind a colon. Same shape
  // as a refund now, which is right: both are money leaving.
  const lines = [
    `🎁 <b>${naira(valueKobo)}</b> given away${count > 1 ? ` (${count} orders)` : ''}`,
    id(orderRef),
    mask(userName),
    service,
  ];
  if (quantity) lines.push(`${quantity.toLocaleString()} qty`);
  lines.push(`Costs us ${naira(costKobo)}`);
  if (reason) lines.push(`${String(reason).charAt(0).toUpperCase()}${String(reason).slice(1)}`);
  lines.push(`by ${adminName}`);
  return send('system', lines.join('\n'));
}

export function tgAdminCredit(adminName, userName, userEmail, amountKobo, type) {
  const label = type === 'gift' ? 'gift' : 'credit';
  return send('system', [
    `🏦 <b>${naira(amountKobo)}</b> ${label}`,
    mask(userName), mask(userEmail), `by ${adminName}`,
  ].join('\n'));
}

// ── System ─────────────────────────────────────────────
export function tgProviderBalance(alerts) {
  // The figure leads, and the action it implies gets said. Title case and the
  // leading indent were the only two in the file.
  const rows = alerts.map(a => [
    `⚠️ <b>$${a.balance.toFixed(2)}</b> left upstream`,
    `Below the $${a.threshold} floor`,
    'top up before the next sync',
  ].join('\n')).join('\n\n');
  return send('system', rows);
}

export function tgFxUpdate(oldRate, newRate, market, buffer) {
  return send('system', `📈 Rate now <b>₦${newRate}</b>\nWas ₦${oldRate}\nMarket ₦${market} plus our ₦${buffer} buffer`);
}

export function tgDripTimeout(orderId, batch, detail, apiOrderId, provider) {
  // Two bare ids used to stack with no label, one ours and one theirs. The
  // provider name drops: the topic is already ours and the order id is enough
  // to find it, and naming them in a message that gets forwarded is the habit
  // the house rule exists to stop.
  const lines = [`⏱ Batch ${batch} timed out`, id(orderId)];
  if (apiOrderId) lines.push(`Upstream order ${id(apiOrderId)}`);
  lines.push(detail || 'Check the dashboard before retrying');
  return send('timeout', lines.join('\n'));
}

export function tgDispatchFailed(orderId, error) {
  // 🔴 is also the refund marker, so at a glance these were the same event.
  // (No caller today — kept in step with the rest of the file.)
  return send('orders', `🔴 Order never got sent\n${id(orderId)}\n${error}`);
}

export function tgDailySummary(stats) {
  const rows = Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `  ${k}: <b>${v}</b>`).join('\n');
  return send('system', `📊 <b>Daily Summary</b>\n${rows}`);
}

export function tgDigest(date, time, s) {
  return send('pulse', [
    `📊 <b>Pulse</b> | ${date}, ${time} WAT`,
    '',
    '<b>Today</b>',
    `💰 Revenue <b>${s.revenue}</b>${s.revenuePct}`,
    `📈 Profit <b>${s.profit}</b> | ${s.markup} up on cost`,
    `🏦 Money in <b>${s.deposits}</b>${s.depositsPct}`,
    `📦 Orders <b>${s.orders}</b>${s.ordersPct}, ${s.processing} still running`,
    `👤 New users <b>${s.newUsers}</b>, ${s.totalUsers.toLocaleString()} all told`,
    '',
    '<b>This month</b>',
    `💰 Revenue <b>${s.monthRevenue}</b> net`,
    ...(s.monthRefunds ? [`   after ${s.monthRefunds} refunded`] : []),
    `📈 Profit <b>${s.monthProfit}</b> | ${s.monthMarkup} up on cost`,
    `🏦 Money in <b>${s.monthDeposits}</b>`,
    `📦 Orders <b>${s.monthOrders}</b>`,
  ].join('\n'));
}

// ── Tasks ─────────────────────────────────────────────
export function tgTaskSubmission(userName, userEmail, taskTitle, proof, platform, submissionId, reward) {
  const link = proofToLink(proof, platform);
  // Header kept; the three `Label:` prefixes go, since the buttons underneath
  // already say what the message is for.
  const lines = ['📋 <b>Task submission</b>', mask(userName || userEmail), taskTitle];
  if (reward) lines.push(`<b>${naira(reward)}</b> reward`);
  if (link) lines.push(`<a href="${link.url}">See the proof</a>`);
  else if (proof) lines.push(proof);
  const text = lines.join('\n');
  const extra = submissionId
    ? { reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: `ta:${submissionId}` },
      { text: '❌ Reject', callback_data: `tr:${submissionId}` },
    ]] } }
    : undefined;
  return send('tasks', text, extra);
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
const OUTREACH_TOPICS = { day1: 8, day3: 9, day7: 10, winback: 11, firstDeposit: 13, firstOrder: 14, summary: 400, backlog: 956, watchdog: 2674, conversions: 4740 };
const SITE = 'https://nitro.ng';

const OUTREACH_MESSAGES = {
  day1: {
    reached: (name) =>
      `Hi ${name}, this is Ify from Nitro\n\n`
      + `We spoke briefly today. I saw you signed up recently. I help new people get started, so anything you need, just ask me here. You can start with ₦1,000, and your first deposit from ₦2,500 comes with free credit on top.\n\n`
      + `${SITE}/dashboard`,
    noAnswer: (name) =>
    `Hi ${name}, Ify from Nitro \u{1F44B}\n\n`
    + `I saw you signed up recently. I am the one who helps new people find their way around, so anything you need, just ask me.\n\n`
    + `One question so I can point you the right way. What do you want people to see first? Your page, one post, or something you are dropping soon?\n\n`
    + `Tell me and I will show you where to start. You can start with \u{20A6}1,000, and your first deposit from \u{20A6}2,500 comes with up to \u{20A6}3,000 free to spend.\n\n`
    + `\u{1F449} ${SITE}/dashboard?page=add-funds`,
  },
  day3: {
    reached: (name) =>
      `Hi ${name}, Ify from Nitro\n\n`
      + `In case it helps, here is how it works, about a minute:\n\n`
      + `1. Add funds to your wallet, card or transfer, from ₦1,000.\n`
      + `2. Pick the platform and paste your page or post link.\n`
      + `3. Watch it move live on your dashboard.\n\n`
      + `Your money stays in your own wallet until you spend it, and if an order does not start, every kobo goes straight back. If you are not sure what to pick, send me your link and I will tell you what I would start with.\n\n`
      + `${SITE}/dashboard`,
    noAnswer: (name) =>
    `Hi ${name}, Ify again \u{1F44B}\n\n`
    + `Let me show you how it works. It takes about a minute.\n\n`
    + `1. Open your dashboard and add funds. Card, transfer or crypto, from \u{20A6}1,000.\n`
    + `2. Choose the platform, then paste the link to your page or post.\n`
    + `3. Pick how fast you want it, place the order, then watch it move live on your dashboard.\n\n`
    + `Your money stays in your own wallet until you spend it. And if an order does not start, every kobo goes straight back to your wallet.\n\n`
    + `If you are not sure what to pick, send me your link and I will tell you what I would start with.\n\n`
    + `\u{1F449} ${SITE}/dashboard?page=add-funds`,
  },
  day7: {
    reached: (name) =>
      `Hi ${name}, Ify from Nitro\n\n`
      + `This is my last message about getting started, I will not keep filling your phone. Your free first deposit credit is still there whenever you are ready, and you can start with ₦1,000. Nothing is expiring today.\n\n`
      + `But if something stopped you, the price, what to choose, or whether this thing is real, just reply and tell me. I would rather sort it out than keep messaging you.\n\n`
      + `${SITE}/dashboard`,
    noAnswer: (name) =>
    `Hi ${name}, Ify one last time \u{1F44B}\n\n`
    + `I will not keep filling your phone, so this is my last message about getting started.\n\n`
    + `Your up to \u{20A6}3,000 first deposit credit is still there whenever you are ready, and you can still start with \u{20A6}1,000. Nothing is expiring today.\n\n`
    + `But if something stopped you, whether it is the price, not knowing what to choose, or you were not sure this thing is real, just reply and tell me. I would rather sort it out than keep messaging you.\n\n`
    + `\u{1F449} ${SITE}/dashboard?page=add-funds`,
  },
  winback: {
    reached: (name, creditNaira) =>
      `Hi ${name}, Ify from Nitro\n\n`
      + `We spoke briefly today. I put ₦${Number(creditNaira || 0).toLocaleString()} in free promo credit in your wallet to make coming back easy. It is there now, it works on anything, and it goes after 7 days.\n\n`
      + `Pick the post that deserves better, use the credit on it, and watch it move.\n\n`
      + `${SITE}/dashboard`,
    noAnswer: (name, creditNaira) =>
    `Hi ${name}, Ify from Nitro \u{1F44B}\n\n`
    + `It has been about a month since your last order. Life happens. But your page did not pause with you, and the accounts you were catching up with are still pushing theirs.\n\n`
    + `So I put \u{20A6}${creditNaira.toLocaleString()} in free promo credit in your wallet to make coming back easy. It is there now, it works on anything, and it goes after 7 days.\n\n`
    + `You already know how it works. Pick the post that deserves better, use the credit on it, and watch it move.\n\n`
    + `\u{1F449} ${SITE}/dashboard`,
  },
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

OUTREACH_MESSAGES.backlog = OUTREACH_MESSAGES.day1;

/**
 * Where the conversion feed posts.
 *
 * Its own thread, created 16 Sep 2026 through the bot's own createForumTopic —
 * which is how every other id in this list came to exist, so it is hardcoded
 * here rather than read from the environment like a special case. The summary
 * topic remains the fallback if the id is ever removed from the group, so a
 * deleted thread loses the thread and not the alerts.
 */
const CONVERSION_TOPIC = () => OUTREACH_TOPICS.conversions || OUTREACH_TOPICS.summary;

/**
 * One line when somebody an agent spoke to goes on to pay.
 *
 * Outreach has been running blind on the only question its own staff care
 * about: the summary counts touches and reach rates, and nothing ever connected
 * a call to the money that followed it. This is that connection, live, so the
 * person who made the call sees it the same day rather than in a weekly total.
 */
export function tgOutreachConversion({ name, amountKobo, bonusKobo = 0, method, agent, touch, hoursSince, depositNumber }) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT) return Promise.resolve();
  const amt = naira(amountKobo);
  const bonus = bonusKobo ? ` <i>+ ${naira(bonusKobo)} bonus</i>` : '';
  const nth = depositNumber === 1 ? 'first deposit' : depositNumber ? `deposit #${depositNumber}` : 'deposit';
  const when = hoursSince == null ? ''
    : hoursSince < 1 ? ' \u{2014} within the hour'
    : hoursSince < 48 ? ` \u{2014} ${hoursSince}h after the touch`
    : ` \u{2014} ${Math.round(hoursSince / 24)}d after the touch`;
  const text = `\u{1F3AF} <b>${agent} converted ${name}</b>\n\n`
    + `${amt}${bonus} \u{00B7} ${nth} \u{00B7} ${method}\n`
    + `${touchLabelFor(touch)}${when}`;
  return sendOutreach(text, CONVERSION_TOPIC());
}

/** Touch keys are internal; these are the words the team uses for them. */
const TOUCH_WORDS = { day1: 'Day 1 call', day3: 'Day 3 call', day7: 'Day 7 call', winback: 'Winback', backlog: 'Backlog call', firstDeposit: 'Deposit follow-up', firstOrder: 'Order follow-up' };
function touchLabelFor(t) { return TOUCH_WORDS[t] || t || 'Contacted'; }

/**
 * The end-of-day roll-up: who converted whom, and for how much.
 *
 * Sent even on a day with nothing, because a silent channel and a zero look
 * identical, and the team should be able to tell them apart.
 */
export function tgOutreachDaily({ dayLabel, agents, totalKobo, totalCount, touches }) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT) return Promise.resolve();
  const head = `\u{1F4CA} <b>Outreach conversions \u{00B7} ${dayLabel}</b>`;
  if (!totalCount) {
    return sendOutreach(`${head}\n\nNo deposits from anyone contacted in the last ${touches} days.`, CONVERSION_TOPIC());
  }
  const lines = agents
    .sort((a, b) => b.kobo - a.kobo)
    .map(a => `\u{1F464} <b>${a.name}</b> \u{2014} ${a.count} \u{00B7} ${naira(a.kobo)}`)
    .join('\n');
  const text = `${head}\n\n${lines}\n\n<b>Total</b> \u{2014} ${totalCount} deposits \u{00B7} ${naira(totalKobo)}`;
  return sendOutreach(text, CONVERSION_TOPIC());
}

const OUTREACH_TOPIC_TO_TOUCH = Object.fromEntries(
  Object.entries(OUTREACH_TOPICS).map(([k, v]) => [v, k]),
);

// The single staff list. Imported rather than copied: this lived in four files
// and adding a person meant four edits, with a silent drift if one was missed.
export const STAFF_NAMES = {
  '8567146346': 'Nitro',
  '1935066216': 'Soludo',
  '8911494544': 'Eshiema',
  '8939794301': 'Ify (Eshiema)',
};

// The button set on every outreach card. Shared so the webhook can rebuild it
// when a picker is cancelled and when a due callback posts a new card.
export function outreachButtons(userId) {
  return [
    [{ text: 'Reached', callback_data: `r:${userId}` }, { text: 'No answer', callback_data: `na:${userId}` }],
    [{ text: 'Call back', callback_data: `cb:${userId}` }, { text: 'Unreachable', callback_data: `ur:${userId}` }],
    [{ text: 'Wrong number', callback_data: `wn:${userId}` }, { text: 'DNC', callback_data: `dnc:${userId}` }],
  ];
}

// A fresh contact posted to take the place of one that turned out to be unusable,
// so a dead number does not quietly cost the day a slot.
export async function tgOutreachReplacement(users, touchKey) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT || !users?.length) return;
  const topicId = OUTREACH_TOPICS[touchKey];
  if (!topicId) return;
  for (const u of users) {
    const phone = u.phone?.replace('+', '') || '';
    if (!phone) continue;
    await sendOutreach(
      `\u{1F504} <b>Replacement \u{2014} ${u.name || '(no name)'}</b>\n\u{1F4F1} +${phone}`,
      topicId,
      { inline_keyboard: outreachButtons(u.id) },
    );
  }
}

export { OUTREACH_TOPICS, OUTREACH_TOPIC_TO_TOUCH, OUTREACH_MESSAGES };

export function outreachWhatsAppMessage(touchType, name, {
  variant = 'noAnswer',
  creditNaira,
} = {}) {
  const message = OUTREACH_MESSAGES[touchType];
  const safeName = name || 'Hi \u{1F44B}';
  if (!message) return null;
  if (typeof message === 'function') return message(safeName, creditNaira);
  const fn = message[variant] || message.noAnswer || message.reached;
  return typeof fn === 'function' ? fn(safeName, creditNaira) : null;
}

export function sendOutreach(text, topicId, replyMarkup) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT) return Promise.resolve();
  const body = {
    chat_id: OUTREACH_CHAT,
    message_thread_id: topicId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  // Logged and flushable, for the reason written at the top of this file: an
  // empty catch turns a wrong topic id or a rate limit into silence, and a
  // channel that has gone quiet looks exactly like a day when nothing happened.
  // That matters more here than anywhere — a conversion ping nobody receives is
  // an agent who never learns their call earned anything.
  const p = fetch(`https://api.telegram.org/bot${OUTREACH_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(async (r) => {
      if (!r.ok) log.warn('Telegram', `outreach topic ${topicId} rejected: ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`);
      return r;
    })
    .catch((err) => { log.warn('Telegram', `outreach topic ${topicId} failed: ${err.message}`); })
    .finally(() => inFlight.delete(p));
  inFlight.add(p);
  return p;
}

export async function tgOutreach(users, touchKey, { label } = {}) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT || !users.length) return;
  const topicId = OUTREACH_TOPICS[touchKey];
  if (!topicId) return;
  const total = users.length;
  const heading = label || touchKey;

  await sendOutreach(
    `\u{1F4C7} <b>${heading} \u{2014} ${total} card${total === 1 ? '' : 's'}</b>\n`
    + 'Call first. WhatsApp only if no answer.',
    topicId,
  );

  for (let i = 0; i < total; i++) {
    const u = users[i];
    const idx = i + 1;
    const name = u.name || '(no name)';
    const phone = u.phone?.replace('+', '') || '';

    if (!phone) {
      await sendOutreach(`${idx}. ${name} \u{2014} no phone`, topicId);
      continue;
    }

    const text = `<b>${idx}. ${name}</b>\n\u{1F4F1} +${phone}`;
    await sendOutreach(text, topicId, { inline_keyboard: outreachButtons(u.id) });
    await new Promise(r => setTimeout(r, 3000));
  }
}

// Posts a fresh card for each callback that has come due. Same buttons as a
// normal contact, so staff can set a second callback if they are still busy.
export async function tgOutreachCallback(entries) {
  if (!OUTREACH_TOKEN || !OUTREACH_CHAT || !entries.length) return;
  for (const e of entries) {
    const topicId = OUTREACH_TOPICS[e.touchType];
    const phone = e.user?.phone?.replace('+', '') || '';
    if (!topicId || !phone) continue;
    const name = e.user.name || '(no name)';
    const who = STAFF_NAMES[e.contactedBy] || 'staff';
    await sendOutreach(
      `\u{23F0} <b>Call back \u{2014} ${name}</b>\n\u{1F4F1} +${phone}\n${e.asked} \u{00B7} set by ${who}`,
      topicId,
      { inline_keyboard: outreachButtons(e.user.id) },
    );
    await new Promise(r => setTimeout(r, 3000));
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
      buttons.push([{ text: '\u{2705} Mark as sent', callback_data: `c:${user.id}` }]);
    }
    await sendOutreach(text, topicId, buttons.length ? { inline_keyboard: buttons } : undefined);
  } else if (type === 'firstOrder') {
    const svc = extra.serviceName || '';
    const text = `\u{1F6D2} <b>First order!</b>\n\n<b>${name}</b>${svc ? ` \u{2014} ${svc}` : ''}\n\nSigned up: ${fmtDate(user.createdAt)}`;
    const buttons = [];
    if (phone) {
      const waText = encodeURIComponent(OUTREACH_MESSAGES.firstOrder(waName || 'Hi \u{1F44B}'));
      buttons.push([{ text: '\u{1F4AC} Send WhatsApp', url: `https://wa.me/${phone}?text=${waText}` }]);
      buttons.push([{ text: '\u{2705} Mark as sent', callback_data: `c:${user.id}` }]);
    }
    await sendOutreach(text, topicId, buttons.length ? { inline_keyboard: buttons } : undefined);
  }
}

function fmtDate(d) {
  if (!d) return 'unknown';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
