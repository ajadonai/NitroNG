import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const tickets = await prisma.ticket.findMany({
      where: { userId: session.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        replies: { orderBy: { createdAt: 'asc' } },
      },
    });

    return Response.json({
      tickets: tickets.map(tk => ({
        id: tk.ticketId || tk.id,
        subject: tk.subject,
        message: tk.message,
        category: tk.orderId ? 'Order Issue' : 'General',
        status: tk.status === 'Archived' ? 'Resolved' : tk.status,
        unreadByUser: tk.unreadByUser,
        created: tk.createdAt.toISOString(),
        messages: [
          { from: 'user', text: tk.message, time: tk.createdAt.toISOString() },
          ...tk.replies.map(r => {
            const fromStr = r.from || 'user';
            const isAdmin = fromStr.startsWith('admin');
            const adminName = isAdmin ? (fromStr.split(':')[1] || 'Support') : null;
            return { from: isAdmin ? 'admin' : 'user', name: isAdmin ? `${adminName} - Nitro` : undefined, text: r.message, time: r.createdAt.toISOString() };
          }),
        ],
      })),
    });
  } catch (err) {
    log.error('User Tickets GET', err.message);
    return Response.json({ error: 'Failed to load tickets' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const action = body.action;
    const ticketId = body.ticketId;
    const subject = typeof body.subject === 'string' ? body.subject.replace(/<[^>]*>/g, '') : '';
    const message = typeof body.message === 'string' ? body.message.replace(/<[^>]*>/g, '') : '';
    const category = body.category;

    if (action === 'create') {
      if (!subject?.trim() || !message?.trim()) {
        return Response.json({ error: 'Subject and message required' }, { status: 400 });
      }

      const existing = await prisma.ticket.findFirst({
        where: { userId: session.id, status: { in: ['Open', 'In Progress'] } },
      });
      if (existing) {
        return Response.json({ error: 'You already have an open ticket', ticket: { id: existing.ticketId || existing.id } }, { status: 409 });
      }

      const lastNumeric = await prisma.ticket.findMany({
        where: { OR: [{ ticketId: { startsWith: 'TKT-' } }, { ticketId: { startsWith: 'NTR-' } }] },
        select: { ticketId: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      let maxNum = 0;
      for (const tk of lastNumeric) {
        const n = parseInt(tk.ticketId.replace(/^(TKT|NTR)-/, ''), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
      const newTicketId = `TKT-${maxNum + 1}`;

      const ticket = await prisma.ticket.create({
        data: {
          ticketId: newTicketId,
          userId: session.id,
          subject: subject.trim().slice(0, 200),
          message: message.trim().slice(0, 2000),
          orderId: category === 'Order Issue' ? (message.match(/NTR-[A-Z0-9]+|ORD-[A-Z0-9]+/i)?.[0] || null) : null,
        },
      });

      return Response.json({
        success: true,
        ticket: {
          id: ticket.ticketId,
          subject: ticket.subject,
          status: ticket.status,
          created: ticket.createdAt.toISOString(),
        },
      });
    }

    if (action === 'read') {
      if (!ticketId) return Response.json({ error: 'Ticket ID required' }, { status: 400 });
      const ticket = await prisma.ticket.findFirst({ where: { OR: [{ ticketId }, { id: ticketId }], userId: session.id } });
      if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { unreadByUser: false } });
      return Response.json({ success: true });
    }

    if (action === 'reply') {
      if (!ticketId || !message?.trim()) {
        return Response.json({ error: 'Ticket ID and message required' }, { status: 400 });
      }

      const ticket = await prisma.ticket.findFirst({
        where: { OR: [{ ticketId }, { id: ticketId }], userId: session.id },
      });
      if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });
      if (ticket.status === 'Resolved') return Response.json({ error: 'Ticket is resolved' }, { status: 400 });

      await prisma.ticketReply.create({
        data: { ticketId: ticket.id, from: 'user', message: message.trim().slice(0, 2000) },
      });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { unreadByAdmin: true, unreadByUser: false } });

      return Response.json({ success: true, message: 'Reply sent' });
    }

    if (action === 'close') {
      if (!ticketId) return Response.json({ error: 'Ticket ID required' }, { status: 400 });
      const ticket = await prisma.ticket.findFirst({ where: { OR: [{ ticketId }, { id: ticketId }], userId: session.id } });
      if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'Resolved' } });
      return Response.json({ success: true, message: 'Ticket closed' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('User Tickets POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
