const TOKEN = process.env.TG_BOT_TOKEN;
const CHAT  = process.env.TG_CHAT_ID;
const API   = `https://api.telegram.org/bot${TOKEN}`;

const TOPICS = { revenue: 2, orders: 3, users: 4, system: 5, crew: 6 };

function send(topic, text, extra) {
  if (!TOKEN || !CHAT) return;
  fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_thread_id: TOPICS[topic], text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  }).catch(() => {});
}

function line(label, value) { return `${label}: <b>${value}</b>`; }
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
export function tgPayment(name, amountKobo, bonusKobo, channel) {
  send('revenue', `💰 <b>Payment Received</b>\n${line('User', mask(name))}\n${line('Amount', naira(amountKobo))}${bonusKobo ? `\n${line('Bonus', naira(bonusKobo))}` : ''}${channel ? `\n${line('Channel', channel)}` : ''}`);
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
  send('revenue', `💸 <b>Auto-Refund</b>\n${line('Order', orderId)}\n${line('Amount', naira(amountKobo))}${reason ? `\n${line('Reason', reason)}` : ''}`);
}

// ── Orders ─────────────────────────────────────────────
export function tgNewOrder(orderId, serviceName, qty, chargeKobo, userName, link, platform) {
  const svc = serviceName.length > 50 ? serviceName.slice(0, 47) + '...' : serviceName;
  const label = (platform || 'Link').charAt(0).toUpperCase() + (platform || 'link').slice(1);
  const linkLine = link ? `\n🔗 <a href="${link}">${label}</a>` : '';
  send('orders', `📦 <b>New Order</b>\n${line('ID', orderId)}\n${line('Service', svc)}\n${line('Qty', qty.toLocaleString())} · ${line('Charge', naira(chargeKobo))}\n${line('User', mask(userName))}${linkLine}`);
}

export function tgOrderCancelled(orderId, amountKobo, reason) {
  send('orders', `❌ <b>Order Cancelled</b>\n${line('ID', orderId)}\n${line('Refund', naira(amountKobo))}${reason ? `\n${line('Reason', reason)}` : ''}`);
}

// ── System ─────────────────────────────────────────────
export function tgProviderBalance(alerts) {
  const rows = alerts.map(a => `  ${a.provider}: <b>$${a.balance.toFixed(2)}</b> (min $${a.threshold})`).join('\n');
  send('system', `⚠️ <b>Low Provider Balance</b>\n${rows}`);
}

export function tgFxUpdate(oldRate, newRate, market, buffer) {
  send('system', `📈 <b>FX Rate Updated</b>\n${line('Rate', `₦${oldRate} → ₦${newRate}`)}\n${line('Market', `₦${market}`)}\n${line('Buffer', `₦${buffer}`)}`);
}

export function tgDripTimeout(orderId, batch) {
  send('orders', `⏱ <b>Drip Timeout</b>\n${line('Order', orderId)} batch ${batch}\nCheck provider dashboard before re-dispatching.`);
}

export function tgDispatchFailed(orderId, error) {
  send('orders', `🔴 <b>Dispatch Failed</b>\n${line('Order', orderId)}\n${line('Error', error)}`);
}

export function tgDailySummary(stats) {
  const rows = Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `  ${k}: <b>${v}</b>`).join('\n');
  send('system', `📊 <b>Daily Summary</b>\n${rows}`);
}

// ── Crew ───────────────────────────────────────────────
export function tgCrewApply(name, email) {
  send('crew', `🤝 <b>New Crew Application</b>\n${line('Name', name)}\n${line('Email', mask(email))}`);
}

// ── Callback handler helpers (for webhook) ─────────────
export function tgAnswerCallback(callbackId, text) {
  if (!TOKEN) return;
  fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  }).catch(() => {});
}

export function tgEditMessage(messageId, text) {
  if (!TOKEN || !CHAT) return;
  fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, message_id: messageId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}
