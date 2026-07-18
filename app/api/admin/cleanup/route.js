import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import { cleanupStaleSignups, countStaleSignups, STALE_SIGNUP_DAYS } from '@/lib/stale-signup-cleanup';

export async function POST() {
  const { admin, error } = await requireAdmin('settings', true);
  if (error) return error;

  try {
    const cleanup = await cleanupStaleSignups(prisma);

    await logActivity(admin.name, `Cleaned up ${cleanup.deleted} unverified stale signups`, 'settings');

    return Response.json({
      success: true,
      deleted: cleanup.deleted,
      checked: cleanup.checked,
      cutoffDays: STALE_SIGNUP_DAYS,
      message: `Deleted ${cleanup.deleted} abandoned unverified signups older than ${STALE_SIGNUP_DAYS} days`,
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}

export async function GET() {
  const { admin, error } = await requireAdmin('settings');
  if (error) return error;

  try {
    const [staleCount, unverifiedTotal] = await Promise.all([
      countStaleSignups(prisma),
      prisma.user.count({
        where: { emailVerified: false, status: 'Active', deletedAt: null },
      }),
    ]);

    return Response.json({ staleCount, unverifiedTotal, cutoffDays: STALE_SIGNUP_DAYS });
  } catch (err) {
    log.error('Cleanup GET', err.message);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
