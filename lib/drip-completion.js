import { rescheduleRemaining } from '@/lib/drip-feed';

export async function rescheduleAfterDripCompletion(prisma, orderId) {
  const pending = await prisma.dripDispatch.findMany({
    where: { orderId, status: 'pending' },
    orderBy: [{ day: 'asc' }, { batch: 'asc' }],
  });
  if (!pending.length) return;
  if (pending[0].scheduledAt > new Date()) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      dripConfig: true,
      tier: { select: { group: { select: { type: true, platform: true } } } },
    },
  });
  if (!order) return;

  const dripCfg = order.dripConfig || null;
  const groupType = order.tier?.group?.type || '';
  const groupPlatform = (order.tier?.group?.platform || '').toLowerCase();

  const rescheduled = rescheduleRemaining(pending, dripCfg, groupType, groupPlatform);
  if (!rescheduled.length) return;

  const vals = [], prms = [];
  for (let i = 0; i < rescheduled.length; i++) {
    const b = i * 2;
    vals.push(`($${b+1}, $${b+2}::timestamptz)`);
    prms.push(rescheduled[i].id, rescheduled[i].scheduledAt);
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "drip_dispatches" SET "scheduledAt" = v.t, "updatedAt" = NOW() FROM (VALUES ${vals.join(',')}) AS v(id,t) WHERE "drip_dispatches"."id" = v.id`,
    ...prms,
  );
}
