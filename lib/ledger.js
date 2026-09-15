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
 * What the business actually took in — the "Money in" figure, not "who has a
 * balance". WALLET_FUNDING answers the second question and is right for the
 * nudges and the ad-activation sequence; borrowing it for the first counted
 * money we GAVE AWAY as money that arrived, so every gift made the day look
 * better than it was.
 *
 * `admin_gift` is out: it is a giveaway, and Pulse already reports it under
 * payouts, where it belongs.
 *
 * `admin_credit` stays IN, which looks inconsistent and is not. It is mixed,
 * and most of it is real: staff credit a wallet by hand when a customer pays by
 * bank transfer, or underpays and is topped up — "Credited by Soludo (transfer
 * from ...)", "Didn't input the right amount for the transaction". Of ₦36,601
 * credited in Sep 2026, ₦31,500 was money customers had genuinely sent. Only a
 * minority is goodwill ("cover replacement order for NTR-2644").
 *
 * So dropping it would trade an overstatement for a bigger understatement. The
 * real fix is a subtype on admin_credit the way admin_gift already has one, so
 * an offline deposit and a goodwill credit stop sharing a row. Until then this
 * is the honest split: gifts out, credits in.
 */
export const MONEY_IN = Object.freeze(['deposit', 'admin_credit']);

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
