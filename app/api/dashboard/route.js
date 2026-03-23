import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function GET() {
  try {
    const payload = await getCurrentUser();
    if (!payload) return error('Not authenticated', 401);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        name: true,
        email: true,
        balance: true,
        referralCode: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) return error('User not found', 404);

    // Get orders
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        service: { select: { name: true, platform: true } },
      },
    });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get referral stats
    const referralCount = await prisma.user.count({
      where: { referredBy: user.referralCode },
    });

    const referralEarnings = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'referral' },
      _sum: { amount: true },
    });

    // Get active alerts (user-facing only)
    const alerts = await prisma.alert.findMany({
      where: {
        active: true,
        OR: [{ target: 'both' }, { target: 'dashboard' }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok({
      user: {
        ...user,
        balance: user.balance / 100, // Convert from kobo to naira
        refs: referralCount,
        earnings: (referralEarnings._sum.amount || 0) / 100,
        refCode: user.referralCode,
      },
      orders: orders.map(o => ({
        id: o.id,
        service: o.service?.name || o.serviceId,
        platform: o.service?.platform || 'unknown',
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        status: o.status,
        created: o.createdAt.toISOString(),
      })),
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount / 100,
        method: tx.method || tx.type,
        date: tx.createdAt.toISOString(),
        description: tx.description,
      })),
      alerts: alerts.map(a => ({
        id: a.id,
        message: a.message,
        type: a.type,
      })),
    });
  } catch (err) {
    console.error('Dashboard data error:', err);
    return error('Failed to load dashboard data');
  }
}
