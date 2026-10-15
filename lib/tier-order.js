/**
 * What order tiers appear in, decided here rather than in the database.
 *
 * Budget, Standard, Premium is a product fact: it is the ladder Nitro offers,
 * and the row reads as a ladder only in that order.
 *
 * It is NOT a price sort, and must not be turned into one. Price usually climbs
 * with the tier and sometimes does not — Snapchat Followers has Budget at
 * ₦37,882 against Standard at ₦37,672 — because a tier is a promise about
 * quality and refill, not a position in a price list. Sorting by `sellPer1k`
 * would reorder that group and every future one like it.
 *
 * Until 15 Oct 2026 the order came from each tier's stored `sortOrder`, which
 * meant it was only ever as correct as whatever was last typed into Menu
 * Builder — and Instagram Followers had Standard saved at 2 and Budget at 3, so
 * Budget rendered in the middle of the row for as long as nobody looked.
 *
 * Correcting that row fixed one group. This removes the whole class: the stored
 * number can be anything at all and a ladder still renders in ladder order,
 * because the name decides, not the number.
 *
 * Not every group is a ladder, though. A group tagged `options` holds variants
 * — WhatsApp Poll Votes, where the tier names are "Option A" to "Option E" and
 * the letter picks which answer the votes land on. One is not better than
 * another, so `sortOrder` is exactly right for them and stays in charge. The
 * rule is therefore narrow on purpose: the ladder wins only when BOTH tiers
 * being compared are rungs of it.
 */

export const TIER_LADDER = Object.freeze(['Budget', 'Standard', 'Premium']);

const RANK = new Map(TIER_LADDER.map((name, index) => [name, index]));

/** A rung's position on the ladder, or null for a name that is not on it. */
export function tierRank(tier) {
  const rank = RANK.get(String(tier ?? ''));
  return rank === undefined ? null : rank;
}

export function isLadderTier(tier) {
  return tierRank(tier) !== null;
}

/**
 * Sort comparator for two tier rows. Each needs `tier`; `sortOrder` is read only
 * when the ladder cannot answer. `sellPer1k` is never read — see above.
 */
export function compareTiers(a, b) {
  const rankA = tierRank(a?.tier);
  const rankB = tierRank(b?.tier);
  // Both on the ladder: the ladder decides, whatever the stored numbers or the
  // prices say.
  if (rankA !== null && rankB !== null) return rankA - rankB;
  // Anything else — variants, a name we have never seen, or one of each — is
  // the author's business and keeps the order they gave it.
  return (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0);
}

/** A new array, ordered. Never mutates its input. */
export function sortTiers(tiers) {
  return Array.isArray(tiers) ? [...tiers].sort(compareTiers) : [];
}
