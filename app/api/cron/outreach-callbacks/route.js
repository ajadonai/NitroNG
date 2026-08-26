import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { tgOutreachCallback } from '@/lib/telegram';
import { nextWorkingMorning, watWhen, CALLBACK_MAX_ATTEMPTS } from '@/lib/outreach-time';
import { isOutreachPaused } from '@/lib/outreach-pause';

export const maxDuration = 60;

// A callback that posts and is never actioned re-posts the next working morning.
// After CALLBACK_MAX_ATTEMPTS postings the chain stops. The recycler then hands
// the person back to the ordinary pool rather than retiring them for good.

// tgOutreachCallback sleeps 3s per card for Telegram's per-group rate limit.
// Anything beyond this waits for the next run, which is 15 minutes away.
const PER_RUN = 15;

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await isOutreachPaused()) return Response.json({ ok: true, paused: true });

  try {
    // Covers both an explicit "Call back" and the automatic retry set on no answer.
    const due = await prisma.outreachContact.findMany({
      where: {
        method: { in: ['callback', 'pending'] },
        callbackAt: { not: null, lte: new Date() },
        // Someone who opted out, was deactivated, or had their phone cleared by
        // another touch must never resurface on a re-posted card.
        user: { status: 'Active', outreachOptedOutAt: null, phone: { not: null } },
        // The acquisition touches pitch a first deposit, so anyone who paid between
        // scheduling and firing drops out. Winback deliberately targets past buyers,
        // so it is exempt.
        OR: [
          { touchType: 'winback' },
          { user: { transactions: { none: { type: 'deposit', status: 'Completed' } }, orders: { none: {} } } },
        ],
      },
      select: {
        id: true,
        touchType: true,
        contactedBy: true,
        callbackAt: true,
        callbackAttempts: true,
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { callbackAt: 'asc' },
      take: PER_RUN,
    });

    if (due.length === 0) return Response.json({ ok: true, posted: 0 });

    // Reschedule before posting, so a slow Telegram call cannot double-fire a card.
    // Staff actioning the card clears callbackAt, which ends the retry chain.
    await Promise.allSettled(due.map(c => {
      const attempts = c.callbackAttempts + 1;
      return prisma.outreachContact.update({
        where: { id: c.id },
        data: {
          callbackAttempts: attempts,
          callbackAt: attempts >= CALLBACK_MAX_ATTEMPTS ? null : nextWorkingMorning(),
        },
      });
    }));

    await tgOutreachCallback(due.map(c => ({
      touchType: c.touchType,
      contactedBy: c.contactedBy,
      user: c.user,
      // On a re-post callbackAt holds the reschedule, not what the person asked
      // for, so only the first card quotes a time.
      asked: c.callbackAttempts === 0 ? `Asked for ${watWhen(c.callbackAt)}` : `Retry ${c.callbackAttempts + 1}`,
    })));

    log.info('Outreach Callbacks', `posted ${due.length}`);
    return Response.json({ ok: true, posted: due.length });
  } catch (err) {
    log.error('Outreach Callbacks', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
