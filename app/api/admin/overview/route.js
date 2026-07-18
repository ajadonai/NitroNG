import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, getAdminPages, canSeeSensitive, maskEmail } from '@/lib/admin';
import { watBounds } from '@/lib/format';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';

function humanize(raw) {
  let m;

  // Orders
  if ((m = raw.match(/^Checked order (.+?) via (.+?): (.+)$/))) return `Checked order ${m[1]}\n${m[3].toLowerCase()}`;
  if ((m = raw.match(/^Cancelled order (.+?) \((.+?)\)(.*)/))) return `Cancelled order ${m[1]}${m[3] ? ` and refunded` : ''}`;
  if ((m = raw.match(/^Requested refill for (.+?) \((.+?)\)/))) return `Refill requested for order ${m[1]}`;

  // Tickets
  if ((m = raw.match(/^Claimed ticket (.+)/))) return `Claimed a support ticket`;
  if ((m = raw.match(/^Replied to ticket (.+)/))) return `Replied to a ticket`;
  if ((m = raw.match(/^Resolved ticket (.+)/))) return `Resolved a support ticket`;
  if ((m = raw.match(/^Reopened ticket (.+)/))) return `Reopened a ticket`;
  if ((m = raw.match(/^Archived ticket (.+)/))) return `Archived a ticket`;

  // Payments
  if ((m = raw.match(/^(Enabled|Disabled) (.+?) gateway$/))) return `${m[1]} the ${m[2]} gateway`;
  if ((m = raw.match(/^Configured (.+?) gateway keys$/))) return `Updated ${m[1]} gateway keys`;
  if ((m = raw.match(/^Added (.+?) gateway$/))) return `Added the ${m[1]} gateway`;
  if ((m = raw.match(/^Approved manual deposit (.+?) for (.+)/))) return `${m[1]} deposit for ${m[2]}`;
  if ((m = raw.match(/^Rejected manual deposit (.+?) for (.+)/))) return `Rejected ${m[1]} deposit for ${m[2]}`;

  // Services
  if ((m = raw.match(/^Sync-enabled (\d+) services/))) return `Synced and enabled ${m[1]} services`;
  if ((m = raw.match(/^Disabled service \+ (\d+) tier\(s\): (.+)/))) return `Disabled ${m[2]} and ${m[1]} tier(s)`;
  if ((m = raw.match(/^(Enabled|Disabled) service: (.+)/))) return `${m[1]} ${m[2]}`;
  if ((m = raw.match(/^Updated markup for (.+?) to (.+)/))) return `Set ${m[1]} markup to ${m[2]}`;
  if ((m = raw.match(/^Edited service: (.+)/))) return `Edited ${m[1]}`;
  if ((m = raw.match(/^Disabled service \(has (\d+) orders\): (.+)/))) return `Disabled ${m[2]}`;
  if ((m = raw.match(/^Deleted service: (.+)/))) return `Deleted ${m[1]}`;
  if ((m = raw.match(/^Created service group "(.+?)"/))) return `Created the ${m[1]} group`;
  if ((m = raw.match(/^Updated service group "(.+?)"/))) return `Updated the ${m[1]} group`;
  if ((m = raw.match(/^Deleted service group "(.+?)"/))) return `Deleted the ${m[1]} group`;
  if ((m = raw.match(/^Added (.+?) tier to "(.+?)"/))) return `Added a ${m[1]} tier to ${m[2]}`;
  if ((m = raw.match(/^Recalculated prices: (.+?) updated/))) return `Recalculated prices\n${m[1]} updated`;

  // Users
  if ((m = raw.match(/^(Credited|Debited) (.+?) to (.+)/))) return `${m[1]} ${m[2]} to ${m[3]}'s wallet`;
  if ((m = raw.match(/^Suspended user (.+)/))) return `Suspended ${m[1]}`;
  if ((m = raw.match(/^Activated user (.+)/))) return `Activated ${m[1]}`;
  if ((m = raw.match(/^Reinstated user (.+)/))) return `Reinstated ${m[1]}`;

  // Team
  if ((m = raw.match(/^Created admin: (.+?) \((.+?)\)/))) return `Added ${m[1]} as ${m[2]}`;
  if ((m = raw.match(/^Reset password for (.+)/))) return `Reset ${m[1]}'s password`;
  if ((m = raw.match(/^Deleted admin: (.+?) \((.+?)\)/))) return `Removed admin ${m[1]}`;

  // Alerts
  if ((m = raw.match(/^Created (.+?) alert: "(.+?)"/))) return `Posted an alert: "${m[2]}"`;
  if ((m = raw.match(/^(Enabled|Disabled) alert$/))) return `${m[1]} an alert`;
  if ((m = raw.match(/^Deleted alert/))) return `Deleted an alert`;

  // Settings
  if (raw === 'Updated site settings') return `Updated site settings`;

  // Sync
  if ((m = raw.match(/^Synced from (.+?): (.+?) new, (.+?) updated/))) return `Synced from ${m[1]}\n${m[2]} new, ${m[3]} updated`;
  if ((m = raw.match(/^Synced orders: (.+?) checked, (.+?) updated/))) return `Synced orders\n${m[1]} checked, ${m[2]} updated`;
  if ((m = raw.match(/^Price sync: (.+?) costs updated/))) return `Price sync\n${m[1]} costs updated`;

  // Issues
  if ((m = raw.match(/^Resolved issue: (.+)/))) return `Resolved "${m[1]}"`;
  if ((m = raw.match(/^Fired all crons/))) return `Fired all crons manually`;

  // Notifications
  if ((m = raw.match(/^Queued notification "(.+?)" to (\d+)/))) return `Sent "${m[1]}" to ${m[2]} users`;

  // Acquisition
  if ((m = raw.match(/^Created tracking link: (.+)/))) return `Created tracking link ${m[1]}`;
  if ((m = raw.match(/^(Enabled|Disabled) tracking link: (.+)/))) return `${m[1]} tracking link ${m[2]}`;

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

    // Phase 1: aggregates and counts (no relation sub-queries)
    const [
      userCount, orderCount, processingCount,
      revenueAgg, costAgg, depositsAgg,
      todayOrders, todayRevenueAgg, todayUsers, todayDepositsAgg,
      yesterdayRevenueAgg, yesterdayDepositsAgg,
      partials,
      unreadTicketCount, pendingManualCount, pendingOrderCount, openIssueCount,
    ] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed' }, _sum: { amount: true } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      prisma.order.findMany({ where: { deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true, createdAt: true } }),
      prisma.ticket.count({ where: { unreadByAdmin: true, status: { in: ['Open', 'In Progress'] } } }).catch(() => 0),
      prisma.transaction.count({ where: { type: 'deposit', method: 'manual', status: 'Pending', NOT: { note: { contains: '[awaiting_confirmation]' } } } }).catch(() => 0),
      prisma.order.count({ where: { status: { in: ['Pending', 'Processing'] }, deletedAt: null, queuedBehind: null } }).catch(() => 0),
      prisma.adminIssue?.findMany({ where: { status: 'open' }, select: { type: true }, distinct: ['type'] }).then(r => r.length).catch(() => 0) ?? Promise.resolve(0),
    ]);

    const partialAll = partials;
    const partialToday = partials.filter(p => p.createdAt >= todayStart);
    const partialYesterday = partials.filter(p => p.createdAt >= yesterdayStart && p.createdAt < todayStart);

    // Phase 2: queries with relation includes (generate sub-queries)
    const [recentOrders, recentUsers, openTickets, activityLogs] = await Promise.all([
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { name: true, email: true } },
          service: { select: { name: true, category: true, enabled: true } },
          tier: {
            select: {
              tier: true,
              enabled: true,
              serviceId: true,
              group: { select: { name: true, platform: true, type: true, enabled: true } },
            },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: { where: { status: { not: 'Cancelled' }, deletedAt: null } } } } },
      }),
      prisma.ticket.findMany({
        where: { status: 'Open' },
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { user: { select: { name: true, email: true } } },
      }),
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
      admin: { name: admin.name, role: admin.role, email: admin.email, themePreference: admin.themePreference || 'auto', pages: getAdminPages(admin), customActions: admin.customActions || null },
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
        const offer = getOrderOfferDisplay(o);
        return {
          id: o.orderId || o.id,
          service: offer.serviceName,
          tier: offer.tierLabel,
          platform: offer.platform,
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
          return { action: humanize(text), detail: a.adminName, type: a.type, time: a.createdAt.toISOString() };
        });
      })(),
    });
  } catch (err) {
    log.error('Admin Overview', err.message);
    return Response.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
