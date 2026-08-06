import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { reportOperationalFailure } from '@/lib/monitoring';
import { processMetaCapiOutbox } from '@/lib/meta-capi';

export const maxDuration = 60;

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await processMetaCapiOutbox({ db: prisma });
    return Response.json(stats);
  } catch (error) {
    log.error('MetaCAPI recovery', error.message);
    reportOperationalFailure('meta_capi_recovery_failed', {
      error,
      data: { job: 'meta_capi_cron' },
      dedupeKey: 'meta_capi_recovery_failed',
    });
    return Response.json({ error: 'Meta CAPI recovery failed' }, { status: 500 });
  }
}
