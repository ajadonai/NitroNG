import prisma from '@/lib/prisma';
import { ok } from '@/lib/utils';

export const revalidate = 300;

export async function GET() {
  try {
    let userCount = 0, orderCount = 0;
    try { userCount = await prisma.user.count(); } catch {}
    try { orderCount = await prisma.order.count(); } catch {}

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
        users: userCount >= 1000 ? `${Math.floor(userCount / 1000)}K+` : userCount > 0 ? `${userCount}+` : '0',
        orders: orderCount >= 1000000 ? `${(orderCount / 1000000).toFixed(1)}M+` : orderCount >= 1000 ? `${Math.floor(orderCount / 1000)}K+` : orderCount > 0 ? `${orderCount}+` : '0',
      },
      promo,
      alerts,
    });
  } catch {
    return ok({ stats: { users: '0', orders: '0' }, promo: null, alerts: [] });
  }
}
