import prisma from '@/lib/prisma';
import { STAFF_NAMES } from '@/lib/telegram';
import { sendOutreach, OUTREACH_TOPICS } from '@/lib/telegram';
import {
  message, block, row, outcomeRows, touchRows, staffRows, naira,
} from '@/lib/outreach-format';

export const maxDuration = 60;

// Written by the recycler rather than by a person, so it must never count as
// work done or dilute the reach rate.
const NOT_HUMAN_WORK = 'expired';

function staffName(tgId) { return STAFF_NAMES[String(tgId)] || `Staff ${String(tgId).slice(-4)}`; }

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get('period') || 'week';

  if (period === 'month') {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (tomorrow.getDate() !== 1) {
      return Response.json({ ok: true, skipped: 'not last day of month' });
    }
  }

  const now = new Date();
  const isMonthly = period === 'month';
  const since = isMonthly
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const window = isMonthly
    ? since.toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
    : `${fmt(since)}\u{2013}${fmt(now)}`;

  const contacts = await prisma.outreachContact.findMany({
    where: { contactedAt: { gte: since }, method: { not: NOT_HUMAN_WORK } },
    select: { userId: true, touchType: true, contactedAt: true, contactedBy: true, method: true },
  });

  if (!contacts.length) {
    await sendOutreach(
      `\u{1F4CA} <b>Outreach \u{2014} ${window}</b>\n\n`
      + `Nothing worked this ${isMonthly ? 'month' : 'week'}.`,
      OUTREACH_TOPICS.summary,
    );
    return Response.json({ ok: true, contacts: 0, period });
  }

  const userIds = [...new Set(contacts.map(c => c.userId))];
  const byTouch = {};
  for (const c of contacts) {
    byTouch[c.touchType] = (byTouch[c.touchType] || 0) + 1;
  }

  const earliestContact = {};
  for (const c of contacts) {
    if (!earliestContact[c.userId] || c.contactedAt < earliestContact[c.userId]) {
      earliestContact[c.userId] = c.contactedAt;
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const orders = await prisma.order.findMany({
    where: {
      userId: { in: userIds },
      createdAt: { gte: since },
      status: { not: 'Cancelled' },
    },
    select: { userId: true, charge: true, createdAt: true },
  });

  const deposits = await prisma.transaction.findMany({
    where: {
      userId: { in: userIds },
      type: 'deposit',
      status: 'Completed',
      createdAt: { gte: since },
    },
    select: { userId: true, amount: true, createdAt: true },
  });

  const BUFFER_MS = 0;
  let totalRevenue = 0;
  let totalDeposits = 0;
  const converted = new Set();
  const perUser = {};

  for (const o of orders) {
    const threshold = new Date(earliestContact[o.userId].getTime() + BUFFER_MS);
    if (o.createdAt >= threshold) {
      const charge = Number(o.charge) || 0;
      totalRevenue += charge;
      converted.add(o.userId);
      perUser[o.userId] = (perUser[o.userId] || 0) + charge;
    }
  }

  for (const d of deposits) {
    const threshold = new Date(earliestContact[d.userId].getTime() + BUFFER_MS);
    if (d.createdAt >= threshold) {
      totalDeposits += Number(d.amount) || 0;
    }
  }

  const byMethod = {};
  for (const c of contacts) byMethod[c.method] = (byMethod[c.method] || 0) + 1;

  // A conversion rate on its own says nothing — you cannot tell persuasion from
  // the fact that these people were going to deposit anyway. The control group
  // is everyone handed out in the same window whose card nobody ever worked:
  // same pipeline, same eligibility, no human contact. The gap between the two
  // is the closest thing to a read on whether calling actually does anything.
  const reachedIds = [...new Set(contacts.filter(c => c.method === 'call').map(c => c.userId))];
  const controls = await prisma.user.findMany({
    where: {
      OR: [
        { outreachDay1SentAt: { gte: since } },
        { outreachDay3SentAt: { gte: since } },
        { outreachDay7SentAt: { gte: since } },
        { outreachWinbackSentAt: { gte: since } },
      ],
      // Only rows the recycler wrote, or none at all: nobody worked these.
      outreachContacts: { none: { method: { not: NOT_HUMAN_WORK } } },
    },
    select: { id: true },
  });

  const depositorsIn = async (ids) => {
    if (!ids.length) return { n: 0, dep: 0, sum: 0 };
    const rows = await prisma.transaction.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, type: 'deposit', status: 'Completed', createdAt: { gte: since } },
      _sum: { amount: true },
    });
    return { n: ids.length, dep: rows.length, sum: rows.reduce((a, r) => a + Number(r._sum.amount || 0), 0) };
  };
  const reachedStats = await depositorsIn(reachedIds);
  const controlStats = await depositorsIn(controls.map(u => u.id));
  const pct = (s) => (s.n ? (s.dep / s.n) * 100 : 0);
  const lift = pct(controlStats) > 0 ? pct(reachedStats) / pct(controlStats) : null;

  const topConverters = Object.entries(perUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, rev]) => {
      const u = userMap[uid];
      return row('\u{1F464}', u?.name || u?.email?.split('@')[0] || 'User', naira(Number(rev)));
    });

  const convRate = userIds.length > 0 ? Math.round((converted.size / userIds.length) * 100) : 0;

  const perHead = reachedStats.n ? (reachedStats.sum / reachedStats.n) - (controlStats.n ? controlStats.sum / controlStats.n : 0) : 0;

  const byStaff = {};
  for (const c of contacts) {
    const name = c.contactedBy ? staffName(c.contactedBy) : 'Unassigned';
    byStaff[name] = (byStaff[name] || 0) + 1;
  }

  // Money first. The old order opened with how many touches were made, which is
  // effort, not result \u{2014} you had to read to the bottom to find whether any of
  // it earned anything.
  const text = message(
    `\u{1F4CA} <b>Outreach \u{2014} ${window}</b>`,
    block('Result', [
      row('\u{1F4B0}', 'Deposits', naira(totalDeposits)),
      row('\u{1F4C8}', 'Revenue', naira(totalRevenue)),
      row('\u{1F3AF}', 'Converted', converted.size, `${convRate}% of ${userIds.length}`),
    ]),
    block('Did calling help?', [
      row('\u{2705}', 'Reached', `${pct(reachedStats).toFixed(1)}%`, `${reachedStats.dep} of ${reachedStats.n}, ${naira(reachedStats.sum)}`),
      row('\u{26AA}', 'Not worked', `${pct(controlStats).toFixed(1)}%`, `${controlStats.dep} of ${controlStats.n}, ${naira(controlStats.sum)}`),
      lift ? row('\u{1F4C8}', 'Lift', `${lift.toFixed(1)}\u{00D7}`, `about ${naira(perHead)} per person reached`) : null,
      // Keyed off deposits, not people: a few hundred contacts still yields only a
      // handful of deposits, and that handful is what the whole comparison rests on.
      reachedStats.dep + controlStats.dep < 40
        ? `  <i>Only ${reachedStats.dep + controlStats.dep} deposits between both groups \u{2014} a hint, not a result.</i>`
        : null,
    ]),
    block('Worked', [
      row('\u{1F4C7}', 'Touches', contacts.length),
      row('\u{1F465}', 'People', userIds.length),
    ]),
    block('By touch', touchRows(byTouch)),
    block('Outcomes', outcomeRows(byMethod)),
    block('Staff', staffRows(byStaff)),
    block('Top conversions', topConverters),
  );

  await sendOutreach(text, OUTREACH_TOPICS.summary);

  return Response.json({
    ok: true,
    period,
    contacts: contacts.length,
    users: userIds.length,
    converted: converted.size,
    revenue: totalRevenue,
    deposits: totalDeposits,
  });
}

function fmt(d) {
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
}
