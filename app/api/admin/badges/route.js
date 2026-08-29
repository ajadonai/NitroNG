import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import { log } from '@/lib/logger';

// The six counts the rail's badges show. Light enough to poll from every admin page, so a badge
// clears when the work is done, not when the tab is reloaded. Same queries as the overview.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const [unreadTicketCount, pendingManualCount, pendingOrderCount, openIssueCount, pendingTaskReviewCount, pendingRefillCount] = await Promise.all([
      prisma.ticket.count({ where: { unreadByAdmin: true, status: { in: ['Open', 'In Progress'] } } }).catch(() => 0),
      prisma.transaction.count({ where: { type: 'deposit', method: 'manual', status: 'Pending', NOT: { note: { contains: '[awaiting_confirmation]' } } } }).catch(() => 0),
      prisma.order.count({ where: { status: { in: ['Pending', 'Processing'] }, deletedAt: null, queuedBehind: null } }).catch(() => 0),
      prisma.adminIssue?.findMany({ where: { status: 'open' }, select: { type: true }, distinct: ['type'] }).then(r => r.length).catch(() => 0) ?? Promise.resolve(0),
      prisma.taskSubmission.count({ where: { status: 'pending' } }).catch(() => 0),
      prisma.order.count({ where: { refillRequestedAt: { not: null }, deletedAt: null } }).catch(() => 0),
    ]);
    return Response.json({ unreadTicketCount, pendingManualCount, pendingOrderCount, openIssueCount, pendingTaskReviewCount, pendingRefillCount }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('Admin Badges', err.message);
    return Response.json({ error: 'Failed to load counts' }, { status: 500 });
  }
}
