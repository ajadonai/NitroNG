import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('overview');
  if (error) return error;

  const url = new URL(req.url);
  const since = url.searchParams.get('since');
  if (!since) return Response.json({ events: [] });

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) return Response.json({ events: [] });

  const largeDepositSetting = await prisma.setting.findUnique({ where: { key: 'admin_large_deposit_threshold' } });
  const largeThreshold = largeDepositSetting ? Number(largeDepositSetting.value) : 5000000;

  const staleMinutes = 15;
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);

  const [newTickets, newReplies, newDeposits, pendingManual, staleTickets, priceAlertSetting] = await Promise.all([
    prisma.ticket.findMany({
      where: { createdAt: { gt: sinceDate } },
      select: { ticketId: true, subject: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.ticketReply.findMany({
      where: { createdAt: { gt: sinceDate }, from: 'user' },
      select: { id: true, createdAt: true, ticket: { select: { ticketId: true, subject: true, lockedBy: true, user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { type: 'deposit', status: 'Completed', createdAt: { gt: sinceDate } },
      select: { id: true, amount: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { type: 'deposit', status: 'Pending', method: 'manual', createdAt: { gt: sinceDate }, NOT: { note: { contains: '[awaiting_confirmation]' } } },
      select: { id: true, amount: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.ticket.findMany({
      where: {
        unreadByAdmin: true,
        status: { in: ['Open', 'In Progress'] },
        updatedAt: { lt: staleThreshold },
      },
      select: { ticketId: true, subject: true, updatedAt: true, lockedBy: true, user: { select: { name: true } } },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    }),
    prisma.setting.findUnique({ where: { key: 'price_alerts' } }),
  ]);

  const events = [];

  for (const t of newTickets) {
    events.push({ type: 'new_ticket', id: t.ticketId, title: t.subject, user: t.user?.name || 'User', at: t.createdAt.toISOString() });
  }

  const repliedTicketIds = new Set();
  for (const r of newReplies) {
    const locked = r.ticket.lockedBy;
    if (locked && locked !== admin.name) continue;
    if (repliedTicketIds.has(r.ticket.ticketId)) continue;
    repliedTicketIds.add(r.ticket.ticketId);
    events.push({ type: 'ticket_reply', id: r.id, title: r.ticket.subject, user: r.ticket.user?.name || 'User', at: r.createdAt.toISOString() });
  }

  for (const d of newDeposits) {
    const type = d.amount >= largeThreshold ? 'large_deposit' : 'deposit';
    events.push({ type, id: d.id, amount: d.amount, user: d.user?.name || 'User', at: d.createdAt.toISOString() });
  }

  for (const d of pendingManual) {
    events.push({ type: 'pending_deposit', id: d.id, amount: d.amount, user: d.user?.name || 'User', at: d.createdAt.toISOString() });
  }

  for (const t of staleTickets) {
    if (t.lockedBy && t.lockedBy !== admin.name) continue;
    const mins = Math.round((Date.now() - new Date(t.updatedAt).getTime()) / 60000);
    events.push({ type: 'stale_ticket', id: t.ticketId, title: t.subject, user: t.user?.name || 'User', minutes: mins, at: t.updatedAt.toISOString() });
  }

  if (priceAlertSetting?.value) {
    try {
      const pa = JSON.parse(priceAlertSetting.value);
      if (pa.losers?.length > 0 && pa.checkedAt && new Date(pa.checkedAt) > sinceDate) {
        events.push({ type: 'price_alert', id: 'price_alert', count: pa.losers.length, at: pa.checkedAt });
      }
    } catch {}
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return Response.json({ events });
}
