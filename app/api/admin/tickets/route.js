import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('tickets');
  if (error) return error;

  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { name: true, email: true } },
        replies: { orderBy: { createdAt: 'asc' } },
      },
    });

    const LOCK_EXPIRE_MS = 5 * 60 * 1000; // 5 minutes

    return Response.json({
      tickets: tickets.map(tk => {
        const lockExpired = tk.lockedAt && (Date.now() - new Date(tk.lockedAt).getTime() > LOCK_EXPIRE_MS);
        const lockedBy = (!lockExpired && tk.lockedBy) ? tk.lockedBy : null;
        return {
          id: tk.ticketId || tk.id,
          user: tk.user?.name || 'Unknown',
          email: tk.user?.email || '',
          subject: tk.subject,
          message: tk.message,
          orderId: tk.orderId || '',
          status: tk.status,
          lockedBy,
          created: tk.createdAt.toISOString(),
          replies: tk.replies.map(r => {
            const fromStr = r.from || 'user';
            const isAdmin = fromStr.startsWith('admin');
            const adminName = isAdmin ? (fromStr.split(':')[1] || 'Admin') : null;
            return { from: isAdmin ? 'admin' : 'user', name: isAdmin ? adminName : (tk.user?.name || 'User'), msg: r.message, time: r.createdAt.toISOString() };
          }),
        };
      }),
    });
  } catch (err) {
    log.error('Admin Tickets', err.message);
    return Response.json({ error: 'Failed to load tickets' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('tickets', true);
  if (error) return error;

  try {
    const { action, ticketId, message } = await req.json();
    if (!ticketId) return Response.json({ error: 'Ticket ID required' }, { status: 400 });

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ ticketId }, { id: ticketId }] },
    });
    if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

    if (action === 'lock') {
      const LOCK_EXPIRE_MS = 5 * 60 * 1000;
      const lockExpired = ticket.lockedAt && (Date.now() - new Date(ticket.lockedAt).getTime() > LOCK_EXPIRE_MS);
      if (ticket.lockedBy && ticket.lockedBy !== admin.name && !lockExpired) {
        return Response.json({ error: `Ticket locked by ${ticket.lockedBy}`, lockedBy: ticket.lockedBy }, { status: 409 });
      }
      await prisma.ticket.update({ where: { id: ticket.id }, data: { lockedBy: admin.name, lockedAt: new Date() } });
      return Response.json({ success: true, message: 'Ticket locked' });
    }

    if (action === 'unlock') {
      if (ticket.lockedBy === admin.name || !ticket.lockedBy) {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { lockedBy: null, lockedAt: null } });
      }
      return Response.json({ success: true, message: 'Ticket unlocked' });
    }

    if (action === 'heartbeat') {
      if (ticket.lockedBy === admin.name) {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { lockedAt: new Date() } });
      }
      return Response.json({ success: true });
    }

    if (action === 'reply') {
      if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 });
      // Check lock — only the locking admin or if no lock can reply
      const LOCK_EXPIRE_MS = 5 * 60 * 1000;
      const lockExpired = ticket.lockedAt && (Date.now() - new Date(ticket.lockedAt).getTime() > LOCK_EXPIRE_MS);
      if (ticket.lockedBy && ticket.lockedBy !== admin.name && !lockExpired) {
        return Response.json({ error: `Ticket locked by ${ticket.lockedBy}` }, { status: 409 });
      }
      await prisma.ticketReply.create({
        data: { ticketId: ticket.id, from: `admin:${admin.name}`, message: message.trim() },
      });
      if (ticket.status === 'Open') {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'In Progress' } });
      }
      // Refresh lock
      await prisma.ticket.update({ where: { id: ticket.id }, data: { lockedBy: admin.name, lockedAt: new Date() } });
      await logActivity(admin.name, `Replied to ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Reply sent' });
    }

    if (action === 'resolve') {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'Resolved', lockedBy: null, lockedAt: null } });
      await logActivity(admin.name, `Resolved ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Ticket resolved' });
    }

    if (action === 'reopen') {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'Open' } });
      await logActivity(admin.name, `Reopened ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Ticket reopened' });
    }

    if (action === 'archive') {
      // Archive by setting status to Archived
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'Archived', lockedBy: null, lockedAt: null } });
      await logActivity(admin.name, `Archived ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Ticket archived' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Tickets POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
