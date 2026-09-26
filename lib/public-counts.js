/**
 * A head start on the public order count, from before the real number could
 * carry the page on its own. It comes down 2,000 at a time as real orders
 * grow, and the last step is deleting it.
 *
 *   20,000 → 8,000 → 6,000 (29 Aug 2026, real orders ~8,100)
 *           → 4,000 (14 Sep 2026, real orders 10,363 — the public figure goes
 *             16,363 → 14,363, and the real count now carries most of it)
 *           → 2,000 (26 Sep 2026, real orders 12,402 — the public figure goes
 *             16,402 → 14,402. The real count is now 86% of what we say, and
 *             one more step deletes this file's reason to exist)
 *
 * It lives here because it is quoted in two places — the public site stats
 * behind the landing page, and the {{order_count}} the blog injects — and the
 * two drifted apart once already.
 */
export const ORDER_BASE = 2000;

/** The order figure the public sees. */
export const publicOrderCount = (realOrders = 0) => realOrders + ORDER_BASE;
