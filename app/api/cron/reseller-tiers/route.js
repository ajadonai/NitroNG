/**
 * The nightly walk of the reseller ladder.
 *
 * Promotions land the night they are earned; demotions only at month end. That
 * asymmetry is deliberate and is the whole feel of the thing — a reseller who
 * has a good week gets the better rate immediately, and one who has a slow
 * fortnight loses nothing. Anything else makes the rate feel like a trapdoor.
 *
 * Every decision is written to `reseller_tier_events` with the spend that
 * caused it, because the rolling window has moved by the time anybody reads the
 * row and "why am I on Starter" has to be answerable in three months.
 *
 * Does nothing at all until `reseller_tiers_live` is 'true'. Before that the
 * ladder exists in the database and changes no price, which is what makes it
 * safe to deploy and switch on separately.
 */
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getMarkupSettings } from '@/lib/reseller';
import { evaluate, ladderLive, tiersFrom } from '@/lib/reseller-tiers';
import { spendFor, isMonthEnd, firstMonthEnd } from '@/lib/reseller-spend';

export const maxDuration = 60;

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && auth !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Carries both prefixes: the rungs are reseller_*, the brackets markup_*.
    const settings = await getMarkupSettings();

    if (!ladderLive(settings)) return Response.json({ ok: true, live: false });

    const now = new Date();
    const monthEnd = isMonthEnd(now);
    const tiers = tiersFrom(settings);

    const profiles = await prisma.resellerProfile.findMany({
      where: { enabled: true },
      select: {
        userId: true, tierMode: true, tier: true, pinnedTier: true,
        seatForLife: true, firstMonthEndsAt: true, approvedAt: true,
      },
    });
    if (!profiles.length) return Response.json({ ok: true, live: true, profiles: 0 });

    const spend = await spendFor(profiles.map(p => p.userId), { now });
    const moved = [];

    for (const p of profiles) {
      const s = spend.get(p.userId) || { rolling: 0, lifetime: 0 };
      const data = {};

      // Backfilled once, for profiles granted before the ladder existed. Their
      // clock starts from approval, so an account granted in August is already
      // past its first month and is judged tonight like everybody else.
      if (!p.firstMonthEndsAt) data.firstMonthEndsAt = firstMonthEnd(p.approvedAt || now);
      const withClock = { ...p, firstMonthEndsAt: p.firstMonthEndsAt || data.firstMonthEndsAt };

      const d = evaluate(withClock, s, settings, now, { monthEnd });

      if (d.earnsSeat) {
        data.seatForLife = true;
        data.seatEarnedAt = now;
      }
      if (d.changed) {
        data.tier = d.tier;
        data.tierSince = now;
      }

      if (Object.keys(data).length) {
        await prisma.resellerProfile.update({ where: { userId: p.userId }, data });
      }
      if (d.changed) {
        await prisma.resellerTierEvent.create({
          data: {
            userId: p.userId, fromTier: p.tier, toTier: d.tier,
            reason: d.reason, spendKobo: Math.round(s.rolling), actor: null,
          },
        });
        moved.push({ userId: p.userId, from: p.tier, to: d.tier, reason: d.reason });
      }
      if (d.earnsSeat) {
        await prisma.resellerTierEvent.create({
          data: { userId: p.userId, fromTier: p.tier, toTier: p.tier, reason: 'seat', spendKobo: Math.round(s.lifetime), actor: null },
        });
      }
    }

    if (moved.length) log.info('ResellerTiers', `${moved.length} moved: ${moved.map(m => `${m.from || 'retail'}→${m.to || 'retail'}`).join(', ')}`);
    return Response.json({ ok: true, live: true, profiles: profiles.length, monthEnd, rungs: tiers.length, moved });
  } catch (err) {
    log.error('ResellerTiers', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
