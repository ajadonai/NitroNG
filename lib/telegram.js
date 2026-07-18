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
