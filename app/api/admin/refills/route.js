import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';

export async function GET() {
  const { error } = await requireAdmin('orders');
  if (error) return error;

  try {
    const orders = await prisma.order.findMany({
      // Pending means asked for and not yet sent by an admin.
      where: { refillRequestedAt: { not: null }, refillHandledAt: null, deletedAt: null },
      orderBy: { refillRequestedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, category: true } },
        // getOrderOfferDisplay prefers the at-purchase snapshot, then the public
        // group name, and only falls back to the raw provider string.
        tier: { select: { tier: true, group: { select: { name: true, platform: true } } } },
      },
    });

    // The facts row and the Handled list: asks this month, how fast they get sent, who asks the most.
    const since = new Date(Date.now() - 30 * 864e5);
    const [asked30, handled30] = await Promise.all([
      prisma.order.findMany({ where: { refillRequestedAt: { gte: since }, deletedAt: null }, select: { refillRequestedAt: true, refillHandledAt: true, tier: { select: { group: { select: { platform: true } } } }, service: { select: { category: true } } } }),
      prisma.order.findMany({ where: { refillHandledAt: { gte: since }, deletedAt: null }, orderBy: { refillHandledAt: 'desc' }, take: 20, include: { user: { select: { name: true } }, service: { select: { name: true, category: true } }, tier: { select: { tier: true, group: { select: { name: true, platform: true } } } } } }),
    ]);
    const waits = asked30.filter(o => o.refillHandledAt && o.refillRequestedAt).map(o => o.refillHandledAt - o.refillRequestedAt).sort((a, b) => a - b);
    const byPlatform = {};
    asked30.forEach(o => { const pf = o.tier?.group?.platform || o.service?.category || 'other'; byPlatform[pf] = (byPlatform[pf] || 0) + 1; });
    const topPlatform = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0] || null;
    const facts = {
      waiting: orders.length,
      oldestAsk: orders.length ? orders[orders.length - 1].refillRequestedAt?.toISOString() : null,
      asked30: asked30.length,
      sent30: asked30.filter(o => o.refillHandledAt).length,
      typicalWaitMinutes: waits.length ? Math.round(waits[Math.floor(waits.length / 2)] / 60000) : null,
      topPlatform: topPlatform ? { platform: topPlatform[0], count: topPlatform[1] } : null,
    };
    const handled = handled30.map(o => { const d = getOrderOfferDisplay(o); return { id: o.id, orderId: o.orderId, userName: o.user?.name || 'Unknown', serviceName: d.serviceName, tierLabel: d.tierLabel || null, handledAt: o.refillHandledAt.toISOString() }; });

    return Response.json({
      facts,
      handled,
      refills: orders.map(o => {
        const display = getOrderOfferDisplay(o);
        return {
        id: o.id,
        orderId: o.orderId,
        userName: o.user?.name || 'Unknown',
        userEmail: o.user?.email || '',
        // Was o.service.name — the provider's raw internal string, which is what
        // customers were being shown on this page.
        serviceName: display.serviceName,
        tierLabel: display.tierLabel || null,
        serviceCategory: display.platform || o.service?.category || 'unknown',
        status: o.status,
        quantity: o.quantity,
        link: o.link,
        refillRequestedAt: o.refillRequestedAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
        apiOrderId: o.apiOrderId || null,
        };
      }),
    });
  } catch (err) {
    log.error('Admin Refills', err.message);
    return Response.json({ error: 'Failed to load refills' }, { status: 500 });
  }
}
