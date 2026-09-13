/**
 * The definitions every surface reads orders and money through.
 *
 * One place, because Pulse, the digest, the bot, Overview, the nudges and the
 * cohort maths had each written their own — and the same month read four ways.
 * A file that needs one of these imports it; nothing spells the list out again.
 */

/**
 * Orders in these states never count: not revenue, not activity, not spend.
 * Cancelled is the only one the data holds today; Failed and Rejected are
 * named so the first one to appear lands on the right side of every query
 * instead of inflating revenue in the 39 places that excluded Cancelled alone.
 */
export const DEAD_ORDER_STATES = Object.freeze(['Cancelled', 'Failed', 'Rejected']);

/**
 * Value landed in a wallet, from any source: a deposit the customer made, a
 * credit an admin granted, a gift. This is "money in" on Pulse, the digest,
 * the bot and Overview, and "has funds" for the nudges and the ad-activation
 * sequence — a customer an admin has already credited is not waiting to be
 * activated. Where the question is instead "did the customer pay us" (cohort
 * stats, the welcome bonus, depositCount), the answer is `type: 'deposit'`
 * alone, written as such.
 */
export const WALLET_FUNDING = Object.freeze(['deposit', 'admin_credit', 'admin_gift']);

/**
 * How much of a set of Partial orders' charge and cost was never delivered,
 * in kobo — the share still owed back, pro-rated by the undelivered quantity.
 * The "today" revenue figure on Pulse, the digest, the bot and Overview all
 * subtract this from gross; four copies of this loop used to live in those
 * four files.
 */
export function partialAdjustment(orders) {
  let charge = 0, cost = 0;
  for (const p of orders) {
    const ratio = p.remains / p.quantity;
    charge += Math.round(p.charge * ratio);
    cost += Math.round((p.cost || 0) * ratio);
  }
  return { charge, cost };
}
