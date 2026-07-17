export const maxDuration = 30;

import prisma from '@/lib/prisma';
import {
  cleanupStaleHeartbeats,
  HEARTBEAT_ANONYMOUS_RETENTION_MS,
  HEARTBEAT_CLEANUP_BATCH_SIZE,
  HEARTBEAT_RETENTION_DAYS,
} from '@/lib/heartbeat';
import { log } from '@/lib/logger';

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'Not configured' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupStaleHeartbeats(prisma);
    if (result.deleted > 0) {
      log.info('Heartbeat Cleanup', `Deleted ${result.deleted} expired heartbeat sessions`);
    }
    return Response.json({
      checked: result.checked,
      deleted: result.deleted,
      hasMore: result.hasMore,
      batchSize: HEARTBEAT_CLEANUP_BATCH_SIZE,
      retentionDays: HEARTBEAT_RETENTION_DAYS,
      anonymousRetentionHours: HEARTBEAT_ANONYMOUS_RETENTION_MS / (60 * 60 * 1000),
      identifiedCutoff: result.identifiedCutoff.toISOString(),
      anonymousCutoff: result.anonymousCutoff.toISOString(),
    });
  } catch (err) {
    log.error('Heartbeat Cleanup', err.message);
    return Response.json({ error: 'Heartbeat cleanup failed' }, { status: 500 });
  }
}
