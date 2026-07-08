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
  send('users', `👤 <b>New Signup</b>\n${line('Name', name)}\n${line('Email', mask(email))}${source ? `\n${line('Via', source)}` : ''}`);
}

export function tgUserDeleted(name, email, orderCount, totalSpent) {
  send('users', `🗑 <b>Account Deletion</b>\n${line('Name', name)}\n${line('Email', mask(email))}\n${line('Orders', orderCount)} · ${line('Spent', naira(totalSpent))}`);
}

// ── Revenue ────────────────────────────────────────────
export function tgPayment(name, amountKobo, bonusKobo, channel, approvedBy) {
  send('revenue', `💰 <b>Payment Received</b>\n${line('User', mask(name))}\n${line('Amount', naira(amountKobo))}${bonusKobo ? `\n${line('Bonus', naira(bonusKobo))}` : ''}${channel ? `\n${line('Channel', channel)}` : ''}${approvedBy ? `\n${line('Approved by', approvedBy)}` : ''}`);
}

export function tgManualPending(txId, name, email, amountKobo, senderRef) {
  send('revenue',
    `💳 <b>Manual Deposit — Needs Approval</b>\n${line('User', name)}\n${line('Email', mask(email))}\n${line('Amount', naira(amountKobo))}${senderRef ? `\n${line('Sender Name', senderRef)}` : ''}`,
    { reply_markup: { inline_keyboard: [[
      { text: '✅ Approve', callback_data: `approve:${txId}` },
      { text: '❌ Reject', callback_data: `reject:${txId}` },
    ]] } },
  );
}

export function tgRefund(orderId, amountKobo, reason) {
  send('revenue', `💸 <b>Auto-Refund</b>\n${line('Order', id(orderId))}\n${line('Amount', naira(amountKobo))}${reason ? `\n${line('Reason', reason)}` : ''}`);
}

export function tgRefundAlert({ orderId, amount, charge, qty, remains, status, reason, user, service, source }) {
  const pct = charge > 0 ? Math.round((amount / charge) * 100) : 100;
  const tag = status === 'Partial' ? '⚠️ Partial Refund' : '🔴 Full Refund';
  const lines = [`${line('Order', id(orderId))}`, `${line('Amount', `${naira(amount)} (${pct}% of ${naira(charge)})`)}`];
  if (qty) lines.push(line('Qty', `${qty.toLocaleString()}${remains ? ` · ${remains.toLocaleString()} undelivered` : ''}`));
  if (user) lines.push(line('User', mask(user)));
  if (service) lines.push(line('Service', service.length > 45 ? service.slice(0, 42) + '...' : service));
  if (reason) lines.push(line('Reason', reason));
  if (source) lines.push(line('Source', source));
  send('refunds', `${tag}\n${lines.join('\n')}`);
}

// ── Orders ─────────────────────────────────────────────
export function tgNewOrder(orderId, serviceName, qty, chargeKobo, userName, link, platform) {
  const svc = serviceName.length > 50 ? serviceName.slice(0, 47) + '...' : serviceName;
  const label = (platform || 'Link').charAt(0).toUpperCase() + (platform || 'link').slice(1);
  const linkLine = link ? `\n🔗 <a href="${link}">${label}</a>` : '';
  send('orders', `📦 <b>New Order</b>\n${line('ID', id(orderId))}\n${line('Service', svc)}\n${line('Qty', qty.toLocaleString())} · ${line('Charge', naira(chargeKobo))}\n${line('User', mask(userName))}${linkLine}`);
}

export function tgOrderCancelled(orderId, amountKobo, reason) {
  send('orders', `❌ <b>Order Cancelled</b>\n${line('ID', id(orderId))}\n${line('Refund', naira(amountKobo))}${reason ? `\n${line('Reason', reason)}` : ''}`);
}

// ── System ─────────────────────────────────────────────
export function tgProviderBalance(alerts) {
  const rows = alerts.map(a => `  ${a.provider}: <b>$${a.balance.toFixed(2)}</b> (min $${a.threshold})`).join('\n');
  send('system', `⚠️ <b>Low Provider Balance</b>\n${rows}`);
}

export function tgFxUpdate(oldRate, newRate, market, buffer) {
  send('system', `📈 <b>FX Rate Updated</b>\n${line('Rate', `₦${oldRate} → ₦${newRate}`)}\n${line('Market', `₦${market}`)}\n${line('Buffer', `₦${buffer}`)}`);
}

export function tgDripTimeout(orderId, batch, detail, apiOrderId, provider) {
  const providerLine = provider ? `\n${line('Provider', PROVIDER_NAMES[provider] || provider)}` : '';
  const providerIdLine = apiOrderId ? `\n${line('Provider ID', id(apiOrderId))}` : '';
  send('timeout', `⏱ <b>Drip Timeout</b>\n${line('Order', id(orderId))} batch ${batch}${providerLine}${providerIdLine}\n${detail || 'Check provider dashboard before re-dispatching.'}`);
}

export function tgDispatchFailed(orderId, error) {
  send('orders', `🔴 <b>Dispatch Failed</b>\n${line('Order', id(orderId))}\n${line('Error', error)}`);
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
    `  📈 Profit: <b>${s.profit}</b> (${s.margin} margin)`,
    `  🏦 Money in: <b>${s.deposits}</b>${s.depositsPct}`,
    `  📦 Orders: <b>${s.orders}</b>${s.ordersPct} (${s.processing} processing)`,
    `  👤 New users: <b>${s.newUsers}</b> (${s.totalUsers.toLocaleString()} total)`,
    '',
    '<b>Month to date</b>',
    `  💰 Revenue: <b>${s.monthRevenue}</b>`,
    `  📈 Profit: <b>${s.monthProfit}</b> (${s.monthMargin} margin)`,
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
