import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { applyWelcomeBonus } from '@/lib/welcome-bonus';
import { tgAnswerCallback, tgEditMessage, tgPayment } from '@/lib/telegram';
import { watBounds } from '@/lib/format';
import { getBalance, PROVIDER_IDS, getProviderName, isProviderConfigured } from '@/lib/smm';

export const maxDuration = 60;

const ADMIN_TG_IDS = ['8567146346', '1935066216'];
const ADMIN_TG_NAMES = { '8567146346': 'The Nitro NG', '1935066216': 'Soludo' };
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

// ── Shared helpers ──────────────────────────────────────
const partialAdj = (orders) => {
  let charge = 0, cost = 0;
  for (const p of orders) {
    const ratio = p.remains / p.quantity;
    charge += Math.round(p.charge * ratio);
    cost += Math.round((p.cost || 0) * ratio);
  }
  return { charge, cost };
};
const pct = (a, b) => b === 0 ? (a > 0 ? '🆕' : '—') : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`;
const margin = (rev, cost) => rev > 0 ? `${Math.round(((rev - cost) / rev) * 100)}%` : '—';
const k = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toLocaleString();

// ── /stats — full snapshot ──────────────────────────────
async function handleStats(chatId, threadId) {
  const { todayStart, yesterdayStart, monthStart } = watBounds();

  const [
    totalUsers, todayUsers, monthUsers,
    todayOrderCount, monthOrderCount,
    todayRevAgg, monthRevAgg,
    todayCostAgg, monthCostAgg,
    todayDepositsAgg, monthDepositsAgg,
    processing,
    partialTodayOrders, partialMonthOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart }, emailVerified: true } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
    prisma.order.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
    prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
  ]);

  const adjT = partialAdj(partialTodayOrders);
  const adjM = partialAdj(partialMonthOrders);
  const todayRev = ((todayRevAgg._sum.charge || 0) - adjT.charge) / 100;
  const todayCost = ((todayCostAgg._sum.cost || 0) - adjT.cost) / 100;
  const monthRev = ((monthRevAgg._sum.charge || 0) - adjM.charge) / 100;
  const monthCost = ((monthCostAgg._sum.cost || 0) - adjM.cost) / 100;
  const todayDep = (todayDepositsAgg._sum.amount || 0) / 100;
  const monthDep = (monthDepositsAgg._sum.amount || 0) / 100;

  await reply(chatId, threadId, [
    '📊 <b>Dashboard Snapshot</b>',
    '',
    '<b>Today</b>',
    `  Revenue: <b>${naira(Math.round(todayRev) * 100)}</b>`,
    `  Profit: <b>${naira(Math.round(todayRev - todayCost) * 100)}</b> (${margin(todayRev, todayCost)} margin)`,
    `  Money in: <b>${naira(Math.round(todayDep) * 100)}</b> (${todayDepositsAgg._count} deposits)`,
    `  Orders: <b>${todayOrderCount}</b>  ·  New users: <b>${todayUsers}</b>`,
    '',
    '<b>This month</b>',
    `  Revenue: <b>${naira(Math.round(monthRev) * 100)}</b>`,
    `  Cost: <b>${naira(Math.round(monthCost) * 100)}</b>`,
    `  Profit: <b>${naira(Math.round(monthRev - monthCost) * 100)}</b> (${margin(monthRev, monthCost)} margin)`,
    `  Money in: <b>${naira(Math.round(monthDep) * 100)}</b> (${monthDepositsAgg._count} deposits)`,
    `  Orders: <b>${monthOrderCount.toLocaleString()}</b>  ·  New users: <b>${monthUsers}</b>`,
    '',
    `👥 Total users: <b>${totalUsers.toLocaleString()}</b>  ·  Processing: <b>${processing}</b>`,
  ].join('\n'));
}

// ── /revenue — revenue + money in breakdown ─────────────
async function handleRevenue(chatId, threadId) {
  const { todayStart, yesterdayStart, monthStart } = watBounds();

  const [
    todayRevAgg, yesterdayRevAgg, monthRevAgg, allTimeRevAgg,
    todayCostAgg, monthCostAgg,
    todayDepAgg, yesterdayDepAgg, monthDepAgg, allTimeDepAgg,
    partialTodayO, partialYesterdayO, partialMonthO, partialAllO,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true, cost: true } }),
    prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true, cost: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed' }, _sum: { amount: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
  ]);

  const adjT = partialAdj(partialTodayO);
  const adjY = partialAdj(partialYesterdayO);
  const adjM = partialAdj(partialMonthO);
  const adjA = partialAdj(partialAllO);

  const todayRev = ((todayRevAgg._sum.charge || 0) - adjT.charge) / 100;
  const yesterdayRev = ((yesterdayRevAgg._sum.charge || 0) - adjY.charge) / 100;
  const monthRev = ((monthRevAgg._sum.charge || 0) - adjM.charge) / 100;
  const allTimeRev = ((allTimeRevAgg._sum.charge || 0) - adjA.charge) / 100;
  const todayDep = (todayDepAgg._sum.amount || 0) / 100;
  const yesterdayDep = (yesterdayDepAgg._sum.amount || 0) / 100;
  const monthDep = (monthDepAgg._sum.amount || 0) / 100;
  const allTimeDep = (allTimeDepAgg._sum.amount || 0) / 100;

  await reply(chatId, threadId, [
    '💰 <b>Revenue</b> (what users paid for orders)',
    `  Today: <b>${naira(Math.round(todayRev) * 100)}</b>  ${pct(todayRev, yesterdayRev)} vs yesterday`,
    `  This month: <b>${naira(Math.round(monthRev) * 100)}</b>`,
    `  All time: <b>${naira(Math.round(allTimeRev) * 100)}</b>`,
    '',
    '🏦 <b>Money In</b> (deposits + admin credits)',
    `  Today: <b>${naira(Math.round(todayDep) * 100)}</b> (${todayDepAgg._count} txns)  ${pct(todayDep, yesterdayDep)} vs yesterday`,
    `  This month: <b>${naira(Math.round(monthDep) * 100)}</b> (${monthDepAgg._count} txns)`,
    `  All time: <b>${naira(Math.round(allTimeDep) * 100)}</b>`,
  ].join('\n'));
}

// ── /orders — status breakdown ──────────────────────────
async function handleOrders(chatId, threadId) {
  const { todayStart, yesterdayStart, monthStart } = watBounds();

  const [
    todayCount, yesterdayCount, monthCount,
    statusGroups,
    todayByStatus,
    avgChargeAgg,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
    prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } }),
    prisma.order.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
    prisma.order.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
    prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: todayStart }, deletedAt: null }, _count: true }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _avg: { charge: true }, _count: true }),
  ]);

  const get = (arr, s) => arr.find(g => g.status === s)?._count || 0;
  const avgOrder = avgChargeAgg._avg.charge ? Math.round(avgChargeAgg._avg.charge / 100) : 0;

  await reply(chatId, threadId, [
    '📦 <b>Orders</b>',
    '',
    '<b>Today</b>',
    `  Total: <b>${todayCount}</b>  ${pct(todayCount, yesterdayCount)} vs yesterday`,
    `  ✅ Completed: ${get(todayByStatus, 'Completed')}  ·  ⏳ Processing: ${get(todayByStatus, 'Processing')}`,
    `  🔄 Partial: ${get(todayByStatus, 'Partial')}  ·  ❌ Cancelled: ${get(todayByStatus, 'Cancelled')}`,
    `  🕐 Pending: ${get(todayByStatus, 'Pending')}`,
    '',
    `<b>This month:</b> ${monthCount.toLocaleString()} orders  ·  Avg order: <b>${naira(avgOrder * 100)}</b>`,
    '',
    '<b>Active right now</b>',
    `  ⏳ Processing: <b>${get(statusGroups, 'Processing')}</b>`,
    `  🕐 Pending: <b>${get(statusGroups, 'Pending')}</b>`,
    `  🔄 Partial: <b>${get(statusGroups, 'Partial')}</b>`,
  ].join('\n'));
}

// ── /profit — profit deep dive ──────────────────────────
async function handleProfit(chatId, threadId) {
  const { todayStart, yesterdayStart, monthStart } = watBounds();

  const [
    todayRevAgg, todayCostAgg,
    yesterdayRevAgg, yesterdayCostAgg,
    monthRevAgg, monthCostAgg,
    allTimeRevAgg, allTimeCostAgg,
    monthDepAgg, providerTopupAgg,
    refundAgg,
    partialTodayO, partialYesterdayO, partialMonthO, partialAllO,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
    prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.providerTopup.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'refund', status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
    prisma.order.findMany({ where: { deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
  ]);

  const adjT = partialAdj(partialTodayO);
  const adjY = partialAdj(partialYesterdayO);
  const adjM = partialAdj(partialMonthO);
  const adjA = partialAdj(partialAllO);

  const tRev = ((todayRevAgg._sum.charge || 0) - adjT.charge) / 100;
  const tCost = ((todayCostAgg._sum.cost || 0) - adjT.cost) / 100;
  const yRev = ((yesterdayRevAgg._sum.charge || 0) - adjY.charge) / 100;
  const yCost = ((yesterdayCostAgg._sum.cost || 0) - adjY.cost) / 100;
  const mRev = ((monthRevAgg._sum.charge || 0) - adjM.charge) / 100;
  const mCost = ((monthCostAgg._sum.cost || 0) - adjM.cost) / 100;
  const aRev = ((allTimeRevAgg._sum.charge || 0) - adjA.charge) / 100;
  const aCost = ((allTimeCostAgg._sum.cost || 0) - adjA.cost) / 100;
  const monthDep = (monthDepAgg._sum.amount || 0) / 100;
  const monthTopups = (providerTopupAgg._sum.amount || 0) / 100;
  const monthRefunds = (refundAgg._sum.amount || 0) / 100;

  await reply(chatId, threadId, [
    '📈 <b>Profit Breakdown</b>',
    '',
    '<b>Today</b>',
    `  Revenue: ${naira(Math.round(tRev) * 100)}  ·  Cost: ${naira(Math.round(tCost) * 100)}`,
    `  Profit: <b>${naira(Math.round(tRev - tCost) * 100)}</b> (${margin(tRev, tCost)} margin)`,
    `  ${pct(tRev - tCost, yRev - yCost)} vs yesterday`,
    '',
    '<b>This month</b>',
    `  Revenue: ${naira(Math.round(mRev) * 100)}  ·  Cost: ${naira(Math.round(mCost) * 100)}`,
    `  Profit: <b>${naira(Math.round(mRev - mCost) * 100)}</b> (${margin(mRev, mCost)} margin)`,
    '',
    '<b>All time</b>',
    `  Revenue: ${naira(Math.round(aRev) * 100)}  ·  Cost: ${naira(Math.round(aCost) * 100)}`,
    `  Profit: <b>${naira(Math.round(aRev - aCost) * 100)}</b> (${margin(aRev, aCost)} margin)`,
    '',
    '<b>Cash flow (month)</b>',
    `  Money in: ${naira(Math.round(monthDep) * 100)}`,
    `  Provider top-ups: ${naira(Math.round(monthTopups) * 100)}`,
    `  Net cash: <b>${naira(Math.round(monthDep - monthTopups) * 100)}</b>`,
    `  Refunds: ${naira(Math.round(monthRefunds) * 100)} (${refundAgg._count || 0})`,
  ].join('\n'));
}

// ── /users — user metrics ───────────────────────────────
async function handleUsers(chatId, threadId) {
  const { todayStart, monthStart } = watBounds();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, todayUsers, monthUsers,
    activeOrderers,
    repeatResult,
    idleWithBalance,
    monthDepositors,
    topDepositorsResult,
  ] = await Promise.all([
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart }, emailVerified: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: monthStart }, deletedAt: null }, select: { userId: true }, distinct: ['userId'] }),
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT o."userId")::int AS count
      FROM orders o
      WHERE o."createdAt" >= ${monthStart} AND o."deletedAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM orders p
          WHERE p."userId" = o."userId" AND p."createdAt" < ${monthStart} AND p."deletedAt" IS NULL
        )
    `,
    prisma.user.count({ where: { emailVerified: true, balance: { gt: 0 }, orders: { none: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } } } }),
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT "userId")::int AS count
      FROM transactions
      WHERE type IN ('deposit', 'admin_credit') AND status = 'Completed' AND "createdAt" >= ${monthStart}
    `,
    prisma.$queryRaw`
      SELECT u.name, u.email, SUM(t.amount)::int AS total
      FROM transactions t
      JOIN users u ON u.id = t."userId"
      WHERE t.type IN ('deposit', 'admin_credit') AND t.status = 'Completed' AND t."createdAt" >= ${monthStart}
      GROUP BY u.id, u.name, u.email
      ORDER BY total DESC
      LIMIT 5
    `,
  ]);

  const repeatCount = repeatResult[0]?.count || 0;
  const depositorsCount = monthDepositors[0]?.count || 0;
  const topLines = topDepositorsResult.map((u, i) =>
    `  ${i + 1}. ${u.name || u.email} — <b>${naira(u.total)}</b>`
  );

  await reply(chatId, threadId, [
    '👥 <b>Users</b>',
    '',
    '<b>Growth</b>',
    `  Total: <b>${totalUsers.toLocaleString()}</b>`,
    `  Today: <b>+${todayUsers}</b>  ·  This month: <b>+${monthUsers}</b>`,
    '',
    '<b>Activity (this month)</b>',
    `  Ordered: <b>${activeOrderers.length}</b> users`,
    `  Returning: <b>${repeatCount}</b> (ordered before this month too)`,
    `  Deposited: <b>${depositorsCount}</b> users`,
    `  Idle w/ balance: <b>${idleWithBalance}</b> (no orders in 30d)`,
    '',
    '<b>Top depositors (month)</b>',
    ...topLines,
  ].join('\n'));
}

// ── /top — top platforms + services ─────────────────────
async function handleTop(chatId, threadId) {
  const { monthStart } = watBounds();

  const [platformOrders, topServiceGroups] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } },
      select: { charge: true, status: true, quantity: true, remains: true, service: { select: { category: true } } },
    }),
    prisma.order.groupBy({
      by: ['serviceId'],
      where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } },
      _count: true,
      _sum: { charge: true },
      orderBy: { _sum: { charge: 'desc' } },
      take: 10,
    }),
  ]);

  const effCharge = (o) => {
    if (o.status === 'Partial' && o.remains > 0 && o.quantity > 0)
      return Math.round(o.charge * (o.quantity - o.remains) / o.quantity);
    return o.charge || 0;
  };

  const PLATFORMS = new Set(['instagram', 'youtube', 'tiktok', 'facebook', 'twitter/x', 'telegram', 'spotify', 'twitch', 'snapchat', 'linkedin', 'threads']);
  const pMap = {};
  platformOrders.forEach(o => {
    const cat = (o.service?.category || '').toLowerCase();
    if (!PLATFORMS.has(cat)) return;
    const name = cat === 'twitter/x' ? 'Twitter/X' : cat.charAt(0).toUpperCase() + cat.slice(1);
    if (!pMap[name]) pMap[name] = { orders: 0, revenue: 0 };
    pMap[name].orders++;
    pMap[name].revenue += effCharge(o);
  });
  const topPlatforms = Object.entries(pMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  const serviceIds = topServiceGroups.map(s => s.serviceId);
  const [tiers, services] = await Promise.all([
    prisma.serviceTier.findMany({ where: { serviceId: { in: serviceIds } }, select: { serviceId: true, group: { select: { name: true } } } }),
    prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }),
  ]);
  const groupMap = {};
  tiers.forEach(t2 => { if (t2.serviceId && !groupMap[t2.serviceId]) groupMap[t2.serviceId] = t2.group?.name; });
  const svcMap = {};
  services.forEach(s => { svcMap[s.id] = s.name; });

  const grouped = {};
  topServiceGroups.forEach(s => {
    const name = groupMap[s.serviceId] || svcMap[s.serviceId] || s.serviceId;
    if (!grouped[name]) grouped[name] = { orders: 0, revenue: 0 };
    grouped[name].orders += s._count;
    grouped[name].revenue += s._sum.charge || 0;
  });
  const topServices = Object.entries(grouped)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  const platLines = topPlatforms.map(([name, d], i) =>
    `  ${['🥇','🥈','🥉','4.','5.'][i]} ${name} — <b>${naira(Math.round(d.revenue / 100) * 100)}</b> (${d.orders} orders)`
  );
  const svcLines = topServices.map(([name, d], i) =>
    `  ${i + 1}. ${name} — <b>${naira(Math.round(d.revenue / 100) * 100)}</b> (${d.orders})`
  );

  await reply(chatId, threadId, [
    '🏆 <b>Top Performers (this month)</b>',
    '',
    '<b>By platform</b>',
    ...platLines,
    '',
    '<b>By service</b>',
    ...svcLines,
  ].join('\n'));
}

// ── /pending — pending manual deposits ──────────────────
async function handlePending(chatId, threadId) {
  const pending = await prisma.transaction.findMany({
    where: { method: 'manual', status: 'Pending' },
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { user: { select: { name: true, email: true } } },
  });
  if (!pending.length) { await reply(chatId, threadId, '💳 No pending manual deposits.'); return; }
  const lines = pending.map(tx => {
    const who = tx.user?.name || tx.user?.email || 'Unknown';
    const ago = Math.round((Date.now() - new Date(tx.createdAt).getTime()) / 60000);
    const timeStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
    return `  ${who} — <b>${naira(tx.amount)}</b> · ${timeStr}`;
  });
  await reply(chatId, threadId, [
    `💳 <b>Pending Manual Deposits</b> (${pending.length})`,
    '',
    ...lines,
  ].join('\n'));
}

// ── /check NTR-XXXX — order lookup ────────────────────
async function handleCheck(chatId, threadId, orderId) {
  if (!orderId) { await reply(chatId, threadId, '⚠️ Usage: <code>/check NTR-1566</code>'); return; }
  const id = orderId.toUpperCase();
  const o = await prisma.order.findUnique({
    where: { orderId: id },
    include: {
      user: { select: { name: true } },
      service: { select: { name: true, category: true, provider: true } },
      tier: { select: { tier: true, group: { select: { name: true, platform: true } } } },
      dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }], select: { day: true, batch: true, quantity: true, status: true, scheduledAt: true } },
    },
  });
  if (!o) { await reply(chatId, threadId, `❌ Order <b>${id}</b> not found`); return; }

  const ago = (d) => { if (!d) return '—'; const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
  const statusIcon = { Pending: '🕐', Dispatching: '📤', Processing: '⏳', Completed: '✅', Partial: '🔄', Cancelled: '❌', Refunded: '💸' };
  const delivered = o.quantity - (o.remains || 0);
  const deliveredPct = o.quantity > 0 ? Math.round((delivered / o.quantity) * 100) : 0;
  const div = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
  const serviceName = o.tier?.group?.name || o.service?.category || '—';

  const lines = [
    `🔍 <b>${o.orderId}</b>`,
    div,
    `👤 ${o.user?.name || 'Unknown'}${o.tier ? ` · ${o.tier.tier}` : ''}`,
    `📦 ${serviceName}`,
    `🔗 ${o.link}`,
    div,
    `${statusIcon[o.status] || '⚪'} <b>${o.status}</b>  ·  ${deliveredPct}% delivered`,
    `📊 Qty: <b>${o.quantity.toLocaleString()}</b>  ·  Remains: <b>${(o.remains || 0).toLocaleString()}</b>`,
  ];

  if (o.lastError) { lines.push(div); lines.push(`⚠️ ${o.lastError.slice(0, 120)}`); }

  lines.push(div);
  lines.push(`🏭 <b>${o.service?.provider || '—'}</b>  ·  Ext: <code>${o.apiOrderId || '—'}</code>`);

  if (o.dripDays) {
    const completed = o.dripDispatches.filter(d => d.status === 'completed').length;
    const pending = o.dripDispatches.filter(d => d.status === 'pending').length;
    const processing = o.dripDispatches.filter(d => !['completed', 'pending', 'failed'].includes(d.status)).length;
    const failed = o.dripDispatches.filter(d => d.status === 'failed').length;
    lines.push(div);
    lines.push(`💧 Drip: <b>${o.dripDays} days</b>  ·  ${o.dripDispatches.length} batches`);
    lines.push(`   ✅ ${completed}  ⏳ ${processing}  🕐 ${pending}${failed ? `  ❌ ${failed}` : ''}`);
    const nextPending = o.dripDispatches.find(d => d.status === 'pending');
    if (nextPending) lines.push(`   Next: ${new Date(nextPending.scheduledAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
  }

  lines.push(div);
  lines.push(`📅 ${ago(o.createdAt)}${o.dispatchedAt ? `  ·  Sent ${ago(o.dispatchedAt)}` : ''}${o.completedAt ? `  ·  Done ${ago(o.completedAt)}` : ''}`);
  if (o.retryCount > 0) lines.push(`🔁 Retries: ${o.retryCount}`);

  await reply(chatId, threadId, lines.join('\n'));
}

// ── /balance — provider balances ───────────────────────
async function handleBalance(chatId, threadId) {
  const configured = PROVIDER_IDS.filter(id => isProviderConfigured(id));
  const results = await Promise.allSettled(configured.map(id => getBalance(id).then(r => ({ id, balance: r.balance || r.Balance || '?', currency: r.currency || 'USD' }))));
  const lines = results.map((r, i) => {
    const id = configured[i];
    const name = getProviderName(id);
    if (r.status === 'fulfilled') return `  ${name}: <b>$${Number(r.value.balance).toFixed(2)}</b> ${r.value.currency}`;
    return `  ${name}: ❌ ${r.reason?.message?.slice(0, 60) || 'error'}`;
  });

  await reply(chatId, threadId, [
    '💳 <b>Provider Balances</b>',
    '',
    ...lines,
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

    const arg = msg.text.trim().split(/\s+/)[1];

    try {
      if (command === '/stats') await handleStats(chatId, threadId);
      else if (command === '/revenue') await handleRevenue(chatId, threadId);
      else if (command === '/orders') await handleOrders(chatId, threadId);
      else if (command === '/profit') await handleProfit(chatId, threadId);
      else if (command === '/users') await handleUsers(chatId, threadId);
      else if (command === '/top') await handleTop(chatId, threadId);
      else if (command === '/pending') await handlePending(chatId, threadId);
      else if (command === '/balance') await handleBalance(chatId, threadId);
      else if (command === '/check') await handleCheck(chatId, threadId, arg);
      else if (command === '/help') {
        await reply(chatId, threadId, [
          '🔭 <b>WatchTower Commands</b>',
          '',
          '/stats — Full dashboard snapshot',
          '/revenue — Revenue + money in (today / month / all time)',
          '/orders — Order counts + status breakdown',
          '/profit — Profit, margins, cost, cash flow',
          '/users — Signups, active users, top depositors',
          '/top — Top platforms + services this month',
          '/pending — Pending manual deposits',
          '/balance — Provider balances (MTP, DaoSMM, etc.)',
          '/check NTR-XXXX — Look up any order',
          '/help — This message',
        ].join('\n'));
      }
    } catch (err) {
      log.error('WatchTower command', err.message);
      await reply(chatId, threadId, `❌ Error: ${err.message?.slice(0, 120) || 'unknown'}`);
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
