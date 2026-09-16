/**
 * Yesterday's conversions, per agent.
 *
 * The live ping tells whoever is watching that a call turned into money. This
 * is the same fact totalled at the end of the day, so an agent can see their
 * own run without scrolling a channel, and so a quiet day is visible as a zero
 * rather than as a channel that happened not to post.
 *
 * Deliberately separate from the weekly outreach summary: that one measures
 * work done — touches, reach rate, outcomes — and this one measures what the
 * work produced. Mixing them would let a good reach rate hide a week with no
 * deposits behind it.
 */
import prisma from '@/lib/prisma';
import { tgFlush, tgOutreachDaily, STAFF_NAMES } from '@/lib/telegram';
import { isOutreachPaused } from '@/lib/outreach-pause';
import { ATTRIBUTION_DAYS, NOT_HUMAN_WORK } from '@/lib/outreach-attribution';
import { snap, LAGOS } from '@/lib/acquisition-window';

export const maxDuration = 60;

function staffName(tgId) { return STAFF_NAMES[String(tgId)] || `Staff ${String(tgId).slice(-4)}`; }

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    await tgFlush();
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await isOutreachPaused()) return Response.json({ ok: true, paused: true });

  try {
    // Yesterday in Lagos, whole. The cron fires in the evening, so "today so
    // far" would be a partial day reported as a whole one.
    const todayStart = snap(new Date(), 'day');
    const dayStart = new Date(todayStart.getTime() - 86400000);
    const dayEnd = todayStart;

    const deposits = await prisma.transaction.findMany({
      where: { type: 'deposit', status: 'Completed', createdAt: { gte: dayStart, lt: dayEnd } },
      select: { userId: true, amount: true, createdAt: true },
    });

    const agents = new Map();
    let totalKobo = 0, totalCount = 0;

    for (const d of deposits) {
      // The same rule the live ping uses, applied in bulk: the most recent
      // human touch inside the window, one agent per deposit.
      const touch = await prisma.outreachContact.findFirst({
        where: {
          userId: d.userId,
          contactedAt: { gte: new Date(d.createdAt.getTime() - ATTRIBUTION_DAYS * 86400000), lte: d.createdAt },
          touchType: { notIn: NOT_HUMAN_WORK },
          contactedBy: { not: null },
        },
        orderBy: { contactedAt: 'desc' },
        select: { contactedBy: true },
      });
      if (!touch) continue;
      const name = staffName(touch.contactedBy);
      const cur = agents.get(name) || { name, count: 0, kobo: 0 };
      cur.count += 1;
      cur.kobo += Number(d.amount || 0);
      agents.set(name, cur);
      totalCount += 1;
      totalKobo += Number(d.amount || 0);
    }

    const dayLabel = dayStart.toLocaleDateString('en-GB', { timeZone: LAGOS, weekday: 'short', day: 'numeric', month: 'short' });
    await tgOutreachDaily({ dayLabel, agents: [...agents.values()], totalKobo, totalCount, touches: ATTRIBUTION_DAYS });
    await tgFlush();
    return Response.json({ ok: true, day: dayLabel, deposits: deposits.length, attributed: totalCount, totalKobo });
  } catch (err) {
    await tgFlush();
    return Response.json({ error: err.message }, { status: 500 });
  }
}
