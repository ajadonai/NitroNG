import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { applyWelcomeBonus } from '@/lib/welcome-bonus';
import { tgAnswerCallback, tgEditMessage, tgPayment } from '@/lib/telegram';
import { watBounds } from '@/lib/format';

export const maxDuration = 60;

const ADMIN_TG_IDS = ['8567146346'];
const ADMIN_TG_NAMES = { '8567146346': 'The Nitro NG' };
const TOKEN = process.env.TG_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

function naira(kobo) { return `₦${(kobo / 100).toLocaleString()}`; }

function reply(chatId, threadId, text) {
  if (!TOKEN) return Promise.resolve();
  return fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...(threadId ? { message_thread_id: threadId } : {}), text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}

async function handleOrders(chatId, threadId) {
  const { todayStart } = watBounds();
  const [todayCount, processing, pending] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
    prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
    prisma.order.count({ where: { status: 'Pending', deletedAt: null } }),
  ]);
  await reply(chatId, threadId, [
    '📦 <b>Orders</b>',
    `  Today: <b>${todayCount}</b>`,
    `  Processing: <b>${processing}</b>`,
    `  Pending: <b>${pending}</b>`,
  ].join('\n'));
}

async function handleRevenue(chatId, threadId) {
  const { todayStart, monthStart } = watBounds();

  const partialAdj = (orders) => {
    let charge = 0;
    for (const p of orders) charge += Math.round(p.charge * (p.remains / p.quantity));
    return charge;
  };

  const [
    todayOrdersAgg, monthOrdersAgg, allTimeOrdersAgg,
    todayDepositsAgg, monthDepositsAgg, allTimeDepositsAgg,
    partialToday, partialMonth, partialAll,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true, cost: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true, cost: true } }),
    prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true, cost: true } }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed' }, _sum: { amount: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, quantity: true, remains: true } }),
  ]);

  const todayRev = ((todayOrdersAgg._sum.charge || 0) - partialAdj(partialToday)) / 100;
  const monthRev = ((monthOrdersAgg._sum.charge || 0) - partialAdj(partialMonth)) / 100;
  const allTimeRev = ((allTimeOrdersAgg._sum.charge || 0) - partialAdj(partialAll)) / 100;
  const monthCost = (monthOrdersAgg._sum.cost || 0) / 100;
  const monthProfit = monthRev - monthCost;

  await reply(chatId, threadId, [
    '💰 <b>Revenue</b> (order charges)',
    `  Today: <b>${naira(Math.round(todayRev) * 100)}</b>`,
    `  This month: <b>${naira(Math.round(monthRev) * 100)}</b>`,
    `  All time: <b>${naira(Math.round(allTimeRev) * 100)}</b>`,
    '',
    '🏦 <b>Money In</b> (deposits + credits)',
    `  Today: <b>${naira(todayDepositsAgg._sum.amount || 0)}</b> (${todayDepositsAgg._count} deposits)`,
    `  This month: <b>${naira(monthDepositsAgg._sum.amount || 0)}</b>`,
    `  All time: <b>${naira(allTimeDepositsAgg._sum.amount || 0)}</b>`,
    '',
    `📊 Month profit: <b>${naira(Math.round(monthProfit) * 100)}</b>`,
  ].join('\n'));
}

async function handlePending(chatId, threadId) {
  const pending = await prisma.transaction.findMany({
    where: { method: 'manual', status: 'Pending' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { name: true } } },
  });
  if (!pending.length) { await reply(chatId, threadId, '💳 No pending manual deposits.'); return; }
  const lines = pending.map(tx => `  ${tx.user?.name || 'Unknown'} — <b>${naira(tx.amount)}</b>`);
  await reply(chatId, threadId, ['💳 <b>Pending Manual Deposits</b>', '', ...lines].join('\n'));
}

async function handleStats(chatId, threadId) {
  const { todayStart } = watBounds();
  const [users, todayUsers, orders, todayOrders, todayRevAgg, todayDepositsAgg] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
  ]);
  const todayRev = (todayRevAgg._sum.charge || 0);
  await reply(chatId, threadId, [
    '📊 <b>Quick Stats</b>',
    `  Users: <b>${users.toLocaleString()}</b> (+${todayUsers} today)`,
    `  Orders: <b>${orders.toLocaleString()}</b> (+${todayOrders} today)`,
    `  Revenue today: <b>${naira(todayRev)}</b>`,
    `  Money in today: <b>${naira(todayDepositsAgg._sum.amount || 0)}</b>`,
  ].join('\n'));
}

export async function POST(req) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.CRON_SECRET) return Response.json({ ok: true });

  const update = await req.json();

  if (update.message?.text) {
    const msg = update.message;
    const userId = String(msg.from?.id);
    if (!ADMIN_TG_IDS.includes(userId)) return Response.json({ ok: true });

    const command = msg.text.trim().split(/[\s@]/)[0].toLowerCase();
    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id;

    if (command === '/orders') await handleOrders(chatId, threadId);
    else if (command === '/revenue') await handleRevenue(chatId, threadId);
    else if (command === '/pending') await handlePending(chatId, threadId);
    else if (command === '/stats') await handleStats(chatId, threadId);
    else if (command === '/help') {
      await reply(chatId, threadId, [
        '🔭 <b>WatchTower Commands</b>',
        '',
        '/orders — Today\'s order counts',
        '/revenue — Revenue + money in',
        '/pending — Pending manual deposits',
        '/stats — Quick overview',
        '/help — This message',
      ].join('\n'));
    }

    return Response.json({ ok: true });
  }

  const cb = update.callback_query;
  if (!cb?.data || !cb.message) {
    return Response.json({ ok: true });
  }

  const chatId = cb.message.chat?.id || cb.message.sender_chat?.id;
  if (String(chatId) !== process.env.TG_CHAT_ID) {
    return Response.json({ ok: true });
  }

  if (!ADMIN_TG_IDS.includes(String(cb.from?.id))) {
    await tgAnswerCallback(cb.id, 'Not authorised');
    return Response.json({ ok: true });
  }

  const [action, txId] = cb.data.split(':');
  if (!txId) return Response.json({ ok: true });

  try {
    const tx = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx || tx.method !== 'manual') {
      await tgAnswerCallback(cb.id, 'Transaction not found');
      return Response.json({ ok: true });
    }
    if (tx.status !== 'Pending') {
      const label = tx.status === 'Completed' ? '✅ Already approved' : tx.status === 'Rejected' ? '❌ Already rejected' : `⚪ Already ${tx.status.toLowerCase()}`;
      const via = tx.note?.match(/\[(approved|rejected)_by:([^\]]*)\]/);
      const byWho = via ? ` by ${via[2]}` : '';
      await tgAnswerCallback(cb.id, `${label}${byWho}`);
      await tgEditMessage(cb.message.message_id, cb.message.text + `\n\n${label}${byWho}`, { reply_markup: { inline_keyboard: [] } });
      return Response.json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { id: tx.userId }, select: { name: true, email: true } });
    const name = user?.name || user?.email || 'Unknown';
    const amt = `₦${(tx.amount / 100).toLocaleString()}`;
    const adminLabel = (ADMIN_TG_NAMES[String(cb.from?.id)] || 'Nitro') + ' (TG)';

    if (action === 'approve' || action === 'reject') {
      const verb = action === 'approve' ? 'Approve' : 'Reject';
      const emoji = action === 'approve' ? '✅' : '❌';
      await tgAnswerCallback(cb.id, `Confirm ${verb.toLowerCase()}?`);
      await tgEditMessage(cb.message.message_id,
        cb.message.text + `\n\n⚠️ <b>${verb} ${amt} for ${name}?</b>`,
        { reply_markup: { inline_keyboard: [[
          { text: `${emoji} Yes, ${verb}`, callback_data: `confirm_${action}:${txId}` },
          { text: '↩ Cancel', callback_data: `undo:${txId}` },
        ]] } },
      );

    } else if (action === 'undo') {
      await tgAnswerCallback(cb.id, 'Cancelled');
      const originalText = cb.message.text.replace(/\n\n⚠️ .*$/, '');
      await tgEditMessage(cb.message.message_id, originalText, {
        reply_markup: { inline_keyboard: [[
          { text: '✅ Approve', callback_data: `approve:${txId}` },
          { text: '❌ Reject', callback_data: `reject:${txId}` },
        ]] },
      });

    } else if (action === 'confirm_approve') {
      const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
      const couponId = couponMatch?.[1];

      await prisma.$transaction(async (db) => {
        const claimed = await db.transaction.updateMany({
          where: { id: txId, status: 'Pending' },
          data: { status: 'Completed', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, `[approved_by:${adminLabel}]`) },
        });
        if (claimed.count === 0) throw new Error('already_processed');

        let bonus = 0;
        if (couponId) {
          const alreadyUsed = await db.transaction.findFirst({
            where: { userId: tx.userId, type: 'bonus', note: { contains: `[cid:${couponId}]` } },
          });
          if (!alreadyUsed) {
            const [row] = await db.$queryRaw`SELECT value FROM settings WHERE key = 'coupons' FOR UPDATE`;
            if (row) {
              const coupons = JSON.parse(row.value);
              const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
              if (coupon) {
                const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
                const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
                if (notExpired && notMaxed) {
                  const cappedAmount = coupon.maxDeposit > 0 ? Math.min(tx.amount, coupon.maxDeposit * 100) : tx.amount;
                  bonus = coupon.type === 'percent' ? Math.round(cappedAmount * (coupon.value / 100)) : coupon.value * 100;
                  await db.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) } });
                }
              }
            }
          }
        }

        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount + bonus } } });
        if (bonus > 0) {
          await db.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, status: 'Completed', note: `Coupon bonus [cid:${couponId}]` } });
        }
        await applyWelcomeBonus(db, tx.userId, tx.amount);
      });

      await prisma.activityLog.create({
        data: { adminName: adminLabel, action: `Approved manual deposit ${amt} for ${name}`, type: 'payment' },
      });

      await tgAnswerCallback(cb.id, `Approved ${amt}`);
      const finalText = cb.message.text.replace(/\n\n⚠️ .*$/, '') + `\n\n✅ <b>Approved</b> by ${adminLabel}`;
      await tgEditMessage(cb.message.message_id, finalText, { reply_markup: { inline_keyboard: [] } });
      await tgPayment(name, tx.amount, 0, 'Manual', adminLabel);
      log.info('TG Webhook', `Approved manual deposit ${txId} for ${name}`);

    } else if (action === 'confirm_reject') {
      const rejected = await prisma.transaction.updateMany({
        where: { id: txId, status: 'Pending' },
        data: { status: 'Rejected', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, `[rejected_by:${adminLabel}]`) },
      });
      if (rejected.count === 0) throw new Error('already_processed');

      await prisma.activityLog.create({
        data: { adminName: adminLabel, action: `Rejected manual deposit ${amt} for ${name}`, type: 'payment' },
      });

      await tgAnswerCallback(cb.id, 'Rejected');
      const finalText = cb.message.text.replace(/\n\n⚠️ .*$/, '') + `\n\n❌ <b>Rejected</b> by ${adminLabel}`;
      await tgEditMessage(cb.message.message_id, finalText, { reply_markup: { inline_keyboard: [] } });
      log.info('TG Webhook', `Rejected manual deposit ${txId} for ${name}`);
    }
  } catch (err) {
    log.error('TG Webhook', err.message);
    await tgAnswerCallback(cb.id, 'Error — check admin panel');
  }

  return Response.json({ ok: true });
}
