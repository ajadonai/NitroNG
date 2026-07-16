export const maxDuration = 60;

import { log } from '@/lib/logger';
import { recoverStalePendingPayments } from '@/lib/payment-recovery';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await recoverStalePendingPayments();
    return Response.json({
      checked: stats.checked,
      recovered: stats.recovered,
      alreadyCredited: stats.alreadyCredited,
      pending: stats.pending,
      verifying: stats.verifying,
      retryable: stats.retryable,
      failed: stats.failed,
      expired: stats.expired,
      errors: stats.errors.length ? stats.errors : undefined,
    });
  } catch (err) {
    log.error('Payment Recovery', err.message);
    return Response.json({ error: 'Recovery failed' }, { status: 500 });
  }
}
