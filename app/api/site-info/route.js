import prisma from '@/lib/prisma';
import { ok } from '@/lib/utils';

export const revalidate = 300;

export async function GET() {
  try {
    let userCount = 0, orderCount = 0;
    try { userCount = await prisma.user.count(); } catch {}
    try { orderCount = await prisma.order.count(); } catch {}

    const USER_BASE = 2000;
    const ORDER_BASE = 50000;
    const displayUsers = userCount + USER_BASE;
    const displayOrders = orderCount + ORDER_BASE;

    let promo = null;
    try {
      const settings = await prisma.setting.findMany();
      const s = {};
      settings.forEach(x => { s[x.key] = x.value; });
      if (s.promoEnabled === 'true' && s.promoMessage) {
        promo = { message: s.promoMessage, type: s.promoType || 'info' };
      }
    } catch {}

    let alerts = [];
    try {
      alerts = (await prisma.alert.findMany({
        where: {
          active: true,
          deletedAt: null,
          target: { in: ['everyone', 'landing'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })).map(a => ({ id: a.id, message: a.message, type: a.type }));
    } catch {}

    return ok({
      stats: {
        users: displayUsers >= 1000 ? `${Math.floor(displayUsers / 1000)}K+` : `${displayUsers}+`,
        orders: displayOrders >= 1000000 ? `${(displayOrders / 1000000).toFixed(1)}M+` : displayOrders >= 1000 ? `${Math.floor(displayOrders / 1000)}K+` : `${displayOrders}+`,
      },
      promo,
      alerts,
    });
  } catch {
    return ok({ stats: { users: '0', orders: '0' }, promo: null, alerts: [] });
  }
}
