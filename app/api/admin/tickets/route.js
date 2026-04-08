import prisma from '@/lib/prisma';
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

    return Response.json({
      tickets: tickets.map(tk => ({
        id: tk.ticketId || tk.id,
        user: tk.user?.name || 'Unknown',
        email: tk.user?.email || '',
        subject: tk.subject,
        message: tk.message,
        orderId: tk.orderId || '',
        status: tk.status,
        created: tk.createdAt.toISOString(),
        replies: tk.replies.map(r => {
          const isAdmin = r.from.startsWith('admin');
          const adminName = isAdmin ? (r.from.split(':')[1] || 'Admin') : null;
          return { from: isAdmin ? 'admin' : 'user', name: isAdmin ? adminName : (tk.user?.name || 'User'), msg: r.message, time: r.createdAt.toISOString() };
        }),
      })),
    });
  } catch (err) {
    console.error('[Admin Tickets]', err.message);
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

    if (action === 'reply') {
      if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 });
      await prisma.ticketReply.create({
        data: { ticketId: ticket.id, from: `admin:${admin.name}`, message: message.trim() },
      });
      if (ticket.status === 'Open') {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'In Progress' } });
      }
      await logActivity(admin.name, `Replied to ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Reply sent' });
    }

    if (action === 'resolve') {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'Resolved' } });
      await logActivity(admin.name, `Resolved ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Ticket resolved' });
    }

    if (action === 'reopen') {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'Open' } });
      await logActivity(admin.name, `Reopened ticket ${ticketId}`, 'ticket');
      return Response.json({ success: true, message: 'Ticket reopened' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Admin Tickets POST]', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
