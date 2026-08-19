import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { STAMP_FIELD } from '@/lib/outreach-pool';

export const maxDuration = 60;

// Contacts are stamped before their card is sent, so a run that dies halfway
// cannot message anyone twice. The cost is that a card nobody ever worked looks
// exactly like one that was: the stamp records that it was handed out, not that
// anything happened. Roughly 80% of everything ever sent sits in that state.
//
// This gives each of them exactly one more chance. A stamp older than the grace
// period with no outcome recorded against it is marked "expired" and cleared, so
// the contact re-enters the pool. The expired row is itself what stops a second
// recycle: the query only picks up contacts with no row at all.
const GRACE_DAYS = 3;
const PER_TOUCH = 100;

const TOUCHES = ['day1', 'day3', 'day7', 'winback'];

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000);
  const results = {};

  try {
    for (const touch of TOUCHES) {
      const field = STAMP_FIELD[touch];
      const stale = await prisma.user.findMany({
        where: {
          [field]: { not: null, lt: cutoff },
          outreachContacts: { none: { touchType: touch } },
        },
        select: { id: true },
        take: PER_TOUCH,
      });
      if (!stale.length) { results[touch] = 0; continue; }

      // Record the expiry before clearing the stamp. If the run dies between the
      // two, the contact keeps its stamp and is simply picked up again next time,
      // rather than being released with no record of having been handed out.
      await Promise.allSettled(stale.map(u =>
        prisma.outreachContact.upsert({
          where: { userId_touchType: { userId: u.id, touchType: touch } },
          create: { userId: u.id, touchType: touch, method: 'expired' },
          update: { method: 'expired' },
        })
      ));
      await prisma.user.updateMany({
        where: { id: { in: stale.map(u => u.id) } },
        data: { [field]: null },
      });
      results[touch] = stale.length;
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    if (total) log.info('Outreach Recycle', `released ${total}: ${JSON.stringify(results)}`);
    return Response.json({ ok: true, released: total, ...results });
  } catch (err) {
    log.error('Outreach Recycle', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
