/**
 * Which agent gets the credit when a contacted person deposits.
 *
 * Outreach has been running blind on the only question that matters to the
 * people doing it: the summary counts touches, reach rates and outcomes, but
 * nothing has ever connected a call to the money that followed it. An agent
 * could work a list for a week and never see a single naira attributed to them.
 *
 * The rule is deliberately simple and stated here rather than implied, because
 * attribution arguments are worse than no attribution:
 *
 *   — The most recent human touch before the deposit wins. Not the first, not
 *     all of them split: one deposit, one agent, whoever spoke to them last.
 *   — Inside a window. A call in June did not cause a deposit in September, and
 *     crediting it would quietly inflate whoever happened to work the oldest
 *     lists.
 *   — Written by a person. The recycler writes `expired` rows without anybody
 *     speaking to anyone, and those must never earn credit — the same rule the
 *     weekly summary already applies with NOT_HUMAN_WORK.
 *
 * `OutreachContact` already holds who, how and when, so nothing new is stored.
 */
import prisma from './prisma.js';

/**
 * How long a touch can still be claimed for.
 *
 * Fourteen days. Long enough to cover the gap between a call and payday, short
 * enough that nobody is credited for a deposit they had nothing to do with.
 * It is a judgement, not a measurement — if the roll-ups suggest a different
 * number, change it here and it changes everywhere.
 */
export const ATTRIBUTION_DAYS = 14;

/** Rows the recycler writes on its own. Never a person's work. */
export const NOT_HUMAN_WORK = ['expired'];

/**
 * The touch a deposit should be credited to, or null.
 *
 * `at` is the deposit's own timestamp rather than "now" so a replayed or
 * back-dated credit attributes to whoever was actually there at the time.
 */
export async function attributedTouch(userId, at = new Date()) {
  if (!userId) return null;
  const since = new Date(at.getTime() - ATTRIBUTION_DAYS * 86400000);
  const touch = await prisma.outreachContact.findFirst({
    where: {
      userId,
      contactedAt: { gte: since, lte: at },
      touchType: { notIn: NOT_HUMAN_WORK },
      contactedBy: { not: null },
    },
    orderBy: { contactedAt: 'desc' },
    select: { touchType: true, method: true, contactedBy: true, contactedAt: true },
  });
  if (!touch) return null;
  return {
    ...touch,
    // Whole hours: "19h after the call" is the useful shape, and a minute-level
    // figure invites an argument about clock skew that nobody needs to have.
    hoursSince: Math.max(0, Math.round((at.getTime() - new Date(touch.contactedAt).getTime()) / 3600000)),
  };
}
