import prisma from '@/lib/prisma';
import { sendOutreach, OUTREACH_TOPICS } from '@/lib/telegram';

export const maxDuration = 60;

const TOUCH_LABELS = {
  day1: 'Day 1', day3: 'Day 3', day7: 'Day 7',
  winback: 'Winback', firstDeposit: 'First Deposit', firstOrder: 'First Order',
};

const STAFF_NAMES = { '8567146346': 'Nitro', '1935066216': 'Soludo', '8911494544': 'Eshiema' };
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
  const label = isMonthly ? 'Monthly' : 'Weekly';

  const contacts = await prisma.outreachContact.findMany({
    where: { contactedAt: { gte: since } },
    select: { userId: true, touchType: true, contactedAt: true, contactedBy: true },
  });

  if (!contacts.length) {
    await sendOutreach(
      `\u{1F4CA} <b>${label} Outreach Summary</b>\n\n`
      + `<i>${fmt(since)} \u{2013} ${fmt(now)}</i>\n\n`
      + `No outreach contacts recorded this ${isMonthly ? 'month' : 'week'}.`,
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

  const touchBreakdown = Object.entries(byTouch)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${TOUCH_LABELS[k] || k}: ${v}`)
    .join('\n');

  const topConverters = Object.entries(perUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, rev], i) => {
      const u = userMap[uid];
      const name = u?.name || u?.email?.split('@')[0] || 'User';
      return `${i + 1}. ${name} \u{2014} \u{20A6}${Math.round(Number(rev) / 100).toLocaleString()}`;
    })
    .join('\n');

  const convRate = userIds.length > 0 ? Math.round((converted.size / userIds.length) * 100) : 0;

  let text = `\u{1F4CA} <b>${label} Outreach Summary</b>\n`
    + `<i>${fmt(since)} \u{2013} ${fmt(now)}</i>\n\n`
    + `<b>Contacted:</b> ${contacts.length} touches across ${userIds.length} users\n`
    + touchBreakdown + '\n\n'
    + `<b>Converted:</b> ${converted.size} users (${convRate}%)\n`
    + `<b>Deposits after contact:</b> \u{20A6}${Math.round(totalDeposits / 100).toLocaleString()}\n`
    + `<b>Revenue after contact:</b> \u{20A6}${Math.round(totalRevenue / 100).toLocaleString()}`;

  const byStaff = {};
  for (const c of contacts) {
    const name = c.contactedBy ? staffName(c.contactedBy) : 'Unassigned';
    byStaff[name] = (byStaff[name] || 0) + 1;
  }
  const staffBreakdown = Object.entries(byStaff)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `  ${name}: ${count}`)
    .join('\n');

  text += '\n\n<b>By staff:</b>\n' + staffBreakdown;

  if (topConverters) {
    text += '\n\n<b>Top conversions:</b>\n' + topConverters;
  }

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
