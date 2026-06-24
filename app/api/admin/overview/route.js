import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, getAdminPages, canSeeSensitive, maskEmail } from '@/lib/admin';
import { watBounds } from '@/lib/format';

function humanize(raw, admin) {
  const name = admin?.split(' ')[0] || 'Admin';
  let m;

  // Orders
  if ((m = raw.match(/^Checked order (.+?) via (.+?): (.+)$/))) return `${name} checked order ${m[1]} — ${m[3].toLowerCase()}`;
  if ((m = raw.match(/^Cancelled order (.+?) \((.+?)\)(.*)/))) return `${name} cancelled order ${m[1]}${m[3] ? ` and refunded` : ''}`;
  if ((m = raw.match(/^Requested refill for (.+?) \((.+?)\)/))) return `${name} requested a refill for order ${m[1]}`;

  // Tickets
  if ((m = raw.match(/^Claimed ticket (.+)/))) return `${name} claimed a support ticket`;
  if ((m = raw.match(/^Replied to ticket (.+)/))) return `${name} replied to a ticket`;
  if ((m = raw.match(/^Resolved ticket (.+)/))) return `${name} resolved a support ticket`;
  if ((m = raw.match(/^Reopened ticket (.+)/))) return `${name} reopened a ticket`;
  if ((m = raw.match(/^Archived ticket (.+)/))) return `${name} archived a ticket`;

  // Payments
  if ((m = raw.match(/^(Enabled|Disabled) (.+?) gateway$/))) return `${name} ${m[1].toLowerCase()} the ${m[2]} gateway`;
  if ((m = raw.match(/^Configured (.+?) gateway keys$/))) return `${name} updated ${m[1]} gateway keys`;
  if ((m = raw.match(/^Added (.+?) gateway$/))) return `${name} added the ${m[1]} gateway`;
  if ((m = raw.match(/^Approved manual deposit (.+?) for (.+)/))) return `${name} approved ${m[1]} deposit for ${m[2]}`;
  if ((m = raw.match(/^Rejected manual deposit (.+?) for (.+)/))) return `${name} rejected ${m[1]} deposit for ${m[2]}`;

  // Services
  if ((m = raw.match(/^Sync-enabled (\d+) services/))) return `${name} synced and enabled ${m[1]} services`;
  if ((m = raw.match(/^Disabled service \+ (\d+) tier\(s\): (.+)/))) return `${name} disabled ${m[2]} and ${m[1]} tier(s)`;
  if ((m = raw.match(/^(Enabled|Disabled) service: (.+)/))) return `${name} ${m[1].toLowerCase()} ${m[2]}`;
  if ((m = raw.match(/^Updated markup for (.+?) to (.+)/))) return `${name} set ${m[1]} markup to ${m[2]}`;
  if ((m = raw.match(/^Edited service: (.+)/))) return `${name} edited ${m[1]}`;
  if ((m = raw.match(/^Disabled service \(has (\d+) orders\): (.+)/))) return `${name} disabled ${m[2]}`;
  if ((m = raw.match(/^Deleted service: (.+)/))) return `${name} deleted ${m[1]}`;
  if ((m = raw.match(/^Created service group "(.+?)"/))) return `${name} created the ${m[1]} group`;
  if ((m = raw.match(/^Updated service group "(.+?)"/))) return `${name} updated the ${m[1]} group`;
  if ((m = raw.match(/^Deleted service group "(.+?)"/))) return `${name} deleted the ${m[1]} group`;
  if ((m = raw.match(/^Added (.+?) tier to "(.+?)"/))) return `${name} added a ${m[1]} tier to ${m[2]}`;
  if ((m = raw.match(/^Recalculated prices: (.+?) updated/))) return `${name} recalculated prices — ${m[1]} updated`;

  // Users
  if ((m = raw.match(/^(Credited|Debited) (.+?) to (.+)/))) return `${name} ${m[1].toLowerCase()} ${m[2]} to ${m[3]}'s wallet`;
  if ((m = raw.match(/^Suspended user (.+)/))) return `${name} suspended ${m[1]}`;
  if ((m = raw.match(/^Activated user (.+)/))) return `${name} activated ${m[1]}`;
  if ((m = raw.match(/^Reinstated user (.+)/))) return `${name} reinstated ${m[1]}`;

  // Team
  if ((m = raw.match(/^Created admin: (.+?) \((.+?)\)/))) return `${name} added ${m[1]} as ${m[2]}`;
  if ((m = raw.match(/^Reset password for (.+)/))) return `${name} reset ${m[1]}'s password`;
  if ((m = raw.match(/^Deleted admin: (.+?) \((.+?)\)/))) return `${name} removed admin ${m[1]}`;

  // Alerts
  if ((m = raw.match(/^Created (.+?) alert: "(.+?)"/))) return `${name} posted an alert: "${m[2]}"`;
  if ((m = raw.match(/^(Enabled|Disabled) alert$/))) return `${name} ${m[1].toLowerCase()} an alert`;
  if ((m = raw.match(/^Deleted alert/))) return `${name} deleted an alert`;

  // Settings
  if (raw === 'Updated site settings') return `${name} updated site settings`;

  // Sync
  if ((m = raw.match(/^Synced from (.+?): (.+?) new, (.+?) updated/))) return `${name} synced from ${m[1]} — ${m[2]} new, ${m[3]} updated`;
  if ((m = raw.match(/^Synced orders: (.+?) checked, (.+?) updated/))) return `${name} synced orders — ${m[1]} checked, ${m[2]} updated`;
  if ((m = raw.match(/^Price sync: (.+?) costs updated/))) return `${name} ran a price sync — ${m[1]} costs updated`;

  // Issues
  if ((m = raw.match(/^Resolved issue: (.+)/))) return `${name} resolved "${m[1]}"`;
  if ((m = raw.match(/^Fired all crons/))) return `${name} fired all crons manually`;

  // Notifications
  if ((m = raw.match(/^Queued notification "(.+?)" to (\d+)/))) return `${name} sent "${m[1]}" to ${m[2]} users`;

  // Acquisition
  if ((m = raw.match(/^Created tracking link: (.+)/))) return `${name} created tracking link ${m[1]}`;
  if ((m = raw.match(/^(Enabled|Disabled) tracking link: (.+)/))) return `${name} ${m[1].toLowerCase()} tracking link ${m[2]}`;

  return raw;
}

export async function GET() {
  const { admin, error } = await requireAdmin('overview');
  if (error) return error;

  try {
    const { todayStart, yesterdayStart, yesterdaySameTime } = watBounds();

    // All counts + aggregates in parallel
    // Helper: compute partial order adjustment for a date filter
    const partialAdj = (orders) => {
      let charge = 0, cost = 0;
      for (const p of orders) {
        const ratio = p.remains / p.quantity;
        charge += Math.round(p.charge * ratio);
        cost += Math.round((p.cost || 0) * ratio);
      }
      return { charge, cost };
    };

    const [
      userCount, orderCount, processingCount,
      revenueAgg, costAgg, depositsAgg,
      todayOrders, todayRevenueAgg, todayUsers, todayDepositsAgg,
      yesterdayRevenueAgg, yesterdayDepositsAgg,
      partialAll, partialToday, partialYesterday,
      recentOrders, recentUsers, openTickets, unreadTicketCount, pendingManualCount, pendingOrderCount, openIssueCount, activityLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed' }, _sum: { amount: true } }),
      // Today
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      // Yesterday up to same time of day (for fair % change)
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: yesterdaySameTime }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: yesterdayStart, lt: yesterdaySameTime } }, _sum: { amount: true } }),
      // Partial adjustments
      prisma.order.findMany({ where: { deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
      prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
      prisma.order.findMany({ where: { createdAt: { gte: yesterdayStart, lt: yesterdaySameTime }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
      // Recent orders (last 5)
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true, email: true } }, service: { select: { name: true, category: true } }, tier: { select: { tier: true, group: { select: { name: true } } } } },
      }),
      // Recent users (last 5)
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: { where: { status: { not: 'Cancelled' }, deletedAt: null } } } } },
      }),
      // Open tickets (last 4)
      prisma.ticket.findMany({
        where: { status: 'Open' },
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { user: { select: { name: true, email: true } } },
      }),
      // Unread ticket count for badge
      prisma.ticket.count({
        where: { unreadByAdmin: true, status: { in: ['Open', 'In Progress'] } },
      }).catch(() => 0),
      // Pending manual payment count for badge
      prisma.transaction.count({
        where: { method: 'manual', status: 'Pending', NOT: { note: { contains: '[awaiting_confirmation]' } } },
      }).catch(() => 0),
      // Pending + Processing order count for badge
      prisma.order.count({
        where: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
      }).catch(() => 0),
      // Open issue categories count for badge (not individual issues)
      prisma.adminIssue?.findMany({
        where: { status: 'open' },
        select: { type: true },
        distinct: ['type'],
      }).then(r => r.length).catch(() => 0) ?? Promise.resolve(0),
      // Recent activity (last 8)
      prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const adjAll = partialAdj(partialAll);
    const adjToday = partialAdj(partialToday);
    const adjYesterday = partialAdj(partialYesterday);
    const todayRevenue = ((todayRevenueAgg._sum.charge || 0) - adjToday.charge) / 100;
    const yesterdayRevenue = ((yesterdayRevenueAgg._sum.charge || 0) - adjYesterday.charge) / 100;
    const todayDeposits = (todayDepositsAgg._sum.amount || 0) / 100;
    const yesterdayDeposits = (yesterdayDepositsAgg._sum.amount || 0) / 100;

    const pctChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? null : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    const sensitive = canSeeSensitive(admin);

    return Response.json({
      admin: { name: admin.name, role: admin.role, email: admin.email, themePreference: admin.themePreference || 'auto', pages: getAdminPages(admin) },
      revenue: todayRevenue,
      users: userCount,
      orders: orderCount,
      processing: processingCount,
      deposits: todayDeposits,
      ordersToday: todayOrders,
      newUsersToday: todayUsers,
      revenueChange: pctChange(todayRevenue, yesterdayRevenue),
      depositsChange: pctChange(todayDeposits, yesterdayDeposits),
      totalRevenue: ((revenueAgg._sum.charge || 0) - adjAll.charge) / 100,
      ...(sensitive ? {
        totalCost: ((costAgg._sum.cost || 0) - adjAll.cost) / 100,
        totalProfit: (((revenueAgg._sum.charge || 0) - adjAll.charge) - ((costAgg._sum.cost || 0) - adjAll.cost)) / 100,
      } : {}),
      totalDeposits: (depositsAgg._sum.amount || 0) / 100,
      unreadTicketCount,
      pendingManualCount,
      pendingOrderCount,
      openIssueCount,
      openTickets: openTickets.map(tk => ({
        id: tk.ticketId || tk.id,
        subject: tk.subject,
        user: tk.user?.name || (sensitive ? tk.user?.email : maskEmail(tk.user?.email)) || 'Unknown',
        created: tk.createdAt.toISOString(),
      })),
      recentOrders: recentOrders.map(o => {
        const groupName = o.tier?.group?.name;
        const tierLabel = o.tier?.tier;
        return {
          id: o.orderId || o.id,
          service: groupName || o.service?.name || o.serviceId,
          tier: groupName && tierLabel ? tierLabel : null,
          platform: o.service?.category || 'unknown',
          user: o.user?.name || (sensitive ? o.user?.email : maskEmail(o.user?.email)) || 'Unknown',
          charge: (o.charge || 0) / 100,
          status: o.status,
          batchId: o.batchId || null,
          created: o.createdAt.toISOString(),
        };
      }),
      recentUsers: recentUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: sensitive ? u.email : maskEmail(u.email),
        orders: u._count.orders,
        created: u.createdAt.toISOString(),
      })),
      activity: await (async () => {
        const cuidRe = /\bcm[a-z0-9]{20,}\b/g;
        const ids = new Set();
        activityLogs.forEach(a => { for (const m of (a.action || '').matchAll(cuidRe)) ids.add(m[0]); });
        const nameMap = {};
        if (ids.size > 0) {
          const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, email: true } });
          users.forEach(u => { nameMap[u.id] = u.name || u.email || u.id; });
        }
        return activityLogs.map(a => {
          let text = ids.size > 0 ? a.action.replace(cuidRe, id => nameMap[id] || id) : a.action;
          return { action: humanize(text, a.adminName), detail: a.adminName, type: a.type, time: a.createdAt.toISOString() };
        });
      })(),
    });
  } catch (err) {
    log.error('Admin Overview', err.message);
    return Response.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
