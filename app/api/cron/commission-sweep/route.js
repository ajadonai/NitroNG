import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { voidCommissions } from '@/lib/commissions';
import { reportOperationalFailure } from '@/lib/monitoring';

export const maxDuration = 60;

// Every cancel path voids the order's affiliate commission fire-and-forget. If
// that call dies (a dropped database connection did it on NTR-7919), the
// commission stays live on a sale that never happened and nothing comes back
// for it. This does: once a night, any commission still held or approved on a
// Cancelled, Failed or Rejected order is voided. Normally it finds nothing.
const DEAD = ['Cancelled', 'Failed', 'Rejected'];

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const stuck = await prisma.affiliateCommission.findMany({
      where: { status: { in: ['held', 'approved'] }, order: { status: { in: DEAD } } },
      select: { orderId: true, marketerAmount: true, leadAmount: true, order: { select: { orderId: true, status: true } } },
      take: 200,
    });
    const orders = [...new Set(stuck.map(s => s.orderId))];
    let voided = 0;
    for (const id of orders) voided += await voidCommissions(id, 'sweep_cancelled_order');
    if (stuck.length) {
      const kobo = stuck.reduce((s, r) => s + (r.marketerAmount || 0) + (r.leadAmount || 0), 0);
      log.warn('Commission sweep', `${voided} commission(s) voided on ${orders.length} cancelled order(s), ₦${Math.round(kobo / 100).toLocaleString()} exposure`, {
        orders: stuck.map(s => s.order.orderId),
      });
      reportOperationalFailure('commission_sweep_voided', {
        level: 'warning',
        data: { commissions: voided, orders: stuck.map(s => s.order.orderId).slice(0, 20), exposureNaira: Math.round(kobo / 100) },
      });
    }
    return Response.json({ ok: true, found: stuck.length, voided, orders: orders.length });
  } catch (err) {
    log.error('Commission sweep', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
