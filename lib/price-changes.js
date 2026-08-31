import prisma from './prisma';
import { log } from './logger';

/** Persist a batch of price-change rows. Recording is bookkeeping — it must
 * never fail the sync, reprice or edit that produced the rows. */
export async function recordPriceChanges(rows) {
  if (!rows || rows.length === 0) return;
  try {
    for (let i = 0; i < rows.length; i += 100) {
      await prisma.priceChange.createMany({ data: rows.slice(i, i + 100) });
    }
  } catch (err) {
    log.warn('PriceChanges', `Failed to record ${rows.length} price changes: ${err.message}`);
  }
}
