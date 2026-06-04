export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { checkOrder, refillOrder } from '@/lib/smm';

// Auto-refill cron: checks completed orders within their refill window
// for significant drops (>5%) and triggers provider refill.
// Runs once daily via Vercel Cron.
// GET /api/cron/refill

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') || new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = { eligible: 0, checked: 0, refilled: 0, skipped: 0, errors: 0 };

  try {
    // Find completed orders that have refill-enabled tiers and are within their refill window
    const candidates = await prisma.order.findMany({
      where: {
        status: 'Completed',
        apiOrderId: { not: null },
        deletedAt: null,
        completedAt: { not: null },
        tier: { refill: true, refillDays: { gt: 0 } },
      },
      include: {
        service: { select: { provider: true } },
        tier: { select: { refillDays: true } },
      },
      orderBy: { completedAt: 'asc' },
      take: 100,
    });

    // Filter to orders still within their refill window
    const now = Date.now();
    const eligible = candidates.filter(o => {
      const refillDays = o.tier?.refillDays || 30;
      const expiresAt = new Date(o.completedAt).getTime() + refillDays * 24 * 60 * 60 * 1000;
      return now < expiresAt;
    });

    stats.eligible = eligible.length;

    for (const order of eligible) {
      try {
        stats.checked++;
        const provider = order.service?.provider || 'mtp';
        const result = await checkOrder(provider, order.apiOrderId);

        if (!result || result.error) {
          stats.errors++;
          continue;
        }

        const delivered = order.quantity - (order.remains || 0);
        const startCount = order.startCount || 0;
        const currentCount = result.start_count != null ? Number(result.start_count) : null;

        // Can't determine drop without start_count from provider
        if (currentCount == null || startCount === 0) {
          stats.skipped++;
          continue;
        }

        // Calculate drop: how much was lost from what was delivered
        const expectedCount = startCount + delivered;
        const drop = expectedCount - currentCount;
        const dropPercent = delivered > 0 ? (drop / delivered) * 100 : 0;

        // Only refill if drop exceeds 5% threshold
        if (dropPercent <= 5) {
          stats.skipped++;
          continue;
        }

        // Trigger refill
        try {
          const refillResult = await refillOrder(provider, order.apiOrderId);
          if (refillResult?.error) {
            log.warn(`Auto-refill ${order.orderId}`, `Provider error: ${refillResult.error}`);
            stats.errors++;
          } else {
            stats.refilled++;
            log.info('Auto-refill', `${order.orderId}: ${drop} dropped (${dropPercent.toFixed(1)}%), refill triggered`);
          }
        } catch (err) {
          stats.errors++;
          log.warn(`Auto-refill ${order.orderId}`, err.message);
        }
      } catch (err) {
        stats.errors++;
        log.warn(`Auto-refill check ${order.orderId}`, err.message);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    log.info('Cron refill', `Eligible ${stats.eligible}, checked ${stats.checked}, refilled ${stats.refilled}, skipped ${stats.skipped}, errors ${stats.errors}`);
    return Response.json({ success: true, ...stats });
  } catch (err) {
    log.error('Cron refill', err.message);
    return Response.json({ error: err.message, ...stats }, { status: 500 });
  }
}
