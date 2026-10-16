/**
 * Which orders Nitro promises to refill, and for how long.
 *
 * The promise is the tier NAME the customer bought, never the upstream data
 * (CLAUDE.md, "The refill promise is the tier name, not the data"): Budget
 * means no refill, Standard thirty days from completion, Premium for life.
 * `ServiceTier.refill` and `refillDays` describe what the provider offers that
 * week and disagree with the promise constantly (159 of 265 live tiers on 13
 * Oct 2026), so they decide only whether the refill can be passed straight to
 * the provider, not whether the customer may ask.
 *
 * Until 16 Oct 2026 the refill button and the refill route both followed the
 * upstream flag, so a Premium order on a no-refill provider service had no
 * button at all, and a Budget order on a refill-capable one did.
 *
 * Read the name from the order's own snapshot (`tierNameAtPurchase`, falling
 * back to the live tier) so a renamed tier cannot change what was sold. Option
 * groups ("Option A") and full-list orders are not rungs of the ladder and
 * carry no promise.
 */

export const REFILL_PROMISE_DAYS = Object.freeze({ Budget: 0, Standard: 30, Premium: Infinity });

const DAY_MS = 24 * 60 * 60 * 1000;

/** 0 for no refill, a number of days, or Infinity for lifetime. */
export function refillPromiseDays(tierName) {
  const days = REFILL_PROMISE_DAYS[String(tierName ?? '').trim()];
  return days === undefined ? 0 : days;
}

/** Whether a customer may ask for a refill on this order right now. */
export function canRequestRefill({ status, completedAt, tierName }, now = Date.now()) {
  if (status !== 'Completed' || !completedAt) return false;
  const days = refillPromiseDays(tierName);
  if (days === 0) return false;
  if (days === Infinity) return true;
  return now < new Date(completedAt).getTime() + days * DAY_MS;
}
