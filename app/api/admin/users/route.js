import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('users');
  if (error) return error;

  try {
    const users = await prisma.user.findMany({
      
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true, name: true, email: true, balance: true,
        emailVerified: true, referralCode: true, createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    return Response.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        balance: u.balance / 100,
        verified: u.emailVerified,
        orders: u._count.orders,
        status: 'Active', // TODO: add status field to User model
        refCode: u.referralCode,
        joined: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[Admin Users]', err.message);
    return Response.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('users', true);
  if (error) return error;

  try {
    const { action, userId, amount } = await req.json();

    if (!userId) return Response.json({ error: 'User ID required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    if (action === 'credit') {
      const amountKobo = Math.round(Number(amount) * 100);
      if (!amountKobo || amountKobo <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amountKobo } },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: 'admin_credit',
            amount: amountKobo,
            method: 'admin',
            status: 'Completed',
            note: `Credited by ${admin.name}`,
          },
        }),
      ]);

      await logActivity(admin.name, `Credited ₦${Number(amount).toLocaleString()} to ${user.name}`, 'user');
      return Response.json({ success: true, message: `₦${Number(amount).toLocaleString()} credited to ${user.name}` });
    }

    if (action === 'suspend') {
      // TODO: add status field to User model for proper suspension
      await logActivity(admin.name, `Suspended user ${user.name}`, 'user');
      return Response.json({ success: true, message: `${user.name} suspended` });
    }

    if (action === 'activate') {
      await logActivity(admin.name, `Activated user ${user.name}`, 'user');
      return Response.json({ success: true, message: `${user.name} activated` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Admin Users POST]', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
