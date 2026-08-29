/**
 * A head start on the public order count, from before the real number could
 * carry the page on its own. It comes down 2,000 at a time as real orders
 * grow, and the last step is deleting it.
 *
 *   20,000 → 8,000 → 6,000 (29 Aug 2026, real orders ~8,100)
 *
 * It lives here because it is quoted in two places — the public site stats
 * behind the landing page, and the {{order_count}} the blog injects — and the
 * two drifted apart once already.
 */
export const ORDER_BASE = 6000;

/** The order figure the public sees. */
export const publicOrderCount = (realOrders = 0) => realOrders + ORDER_BASE;
