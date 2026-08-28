import prisma from '@/lib/prisma';

/**
 * One definition of revenue, for every surface.
 *
 * A refunded order used to sit in revenue at full charge while its refund was
 * counted somewhere else, which overstated what we actually kept. This nets
 * them, and the decisions behind it are deliberate:
 *
 * 1. PERIOD. A refund lands in the period it was ISSUED, not the period of the
 *    order it came from. Cash reality, and it means a closed month stays
 *    closed — only 5% of refunds cross a month boundary anyway.
 *
 * 2. PARTIALS. A partial order already refunds only the undelivered share, so
 *    subtracting the refund is the whole correction. The charge is NOT also
 *    pro-rated: doing both would take the same money off twice.
 *
 * 3. REFUNDS ON DEAD ORDERS ARE NOT SUBTRACTED. Cancelled, Failed and Rejected
 *    orders are already outside revenue, so their charge was never counted and
 *    taking their refund off again would remove money that was never there.
 *    Two thirds of all refund value is this case; subtracting it would
 *    understate revenue by ~5 points rather than the ~2.6 that is real.
 *
 * 4. ONLY `Completed` REFUNDS. Pending or failed refunds have not left.
 *
 * 5. UNMATCHED REFUNDS ARE SUBTRACTED. Most carry `REF-`/`ADM-REF-`, some carry
 *    `SPLIT-FIX-<code>-REF`, and a few name the order only in the note. All
 *    three are matched below. Anything still unmatched is subtracted anyway
 *    (the money did leave) and surfaced as `unmatchedRefunds` so it is visible
 *    rather than silent.
 */

/** Orders in these states never counted as revenue. */
export const DEAD_STATES = ['Cancelled', 'Failed', 'Rejected'];

const CODE = /NTR-\d+/i;

/** The order code a refund belongs to, whatever shape its reference takes. */
export function refundOrderCode(tx) {
  const ref = tx?.reference || '';
  const fromRef = ref.replace(/^(ADM-)?REF-/i, '').replace(/^SPLIT-FIX-/i, '').replace(/-REF$/i, '');
  if (CODE.test(fromRef)) return fromRef.match(CODE)[0].toUpperCase();
  const fromNote = (tx?.note || '').match(CODE);
  return fromNote ? fromNote[0].toUpperCase() : null;
}

const REFUND_WHERE = { type: { in: ['refund', 'Refund'] }, status: 'Completed' };

/**
 * Gross, refunds and net for a window, plus both margins.
 *
 * @param {Date} [from]  inclusive; omit for all time
 * @param {Date} [to]    exclusive
 * @returns {{gross:number, refunds:number, net:number, cost:number, costWasted:number,
 *            orders:number, refundCount:number, unmatchedRefunds:number,
 *            grossMargin:number, netMargin:number}}  naira, not kobo
 */
export async function getRevenue({ from, to, db = prisma } = {}) {
  const range = {};
  if (from) range.gte = from;
  if (to) range.lt = to;
  const dated = Object.keys(range).length ? { createdAt: range } : {};

  const [live, dead, refunds] = await Promise.all([
    db.order.aggregate({
      where: { ...dated, deletedAt: null, status: { notIn: DEAD_STATES } },
      _sum: { charge: true, cost: true }, _count: true,
    }),
    // Money really spent on orders that died after the provider had them.
    db.order.aggregate({
      where: { ...dated, deletedAt: null, status: { in: DEAD_STATES }, apiOrderId: { not: null } },
      _sum: { cost: true },
    }),
    db.transaction.findMany({
      where: { ...REFUND_WHERE, ...dated },
      select: { amount: true, reference: true, note: true },
    }),
  ]);

  // A refund only reduces revenue if the charge it reverses was in revenue.
  const codes = [...new Set(refunds.map(refundOrderCode).filter(Boolean))];
  const orders = codes.length
    ? await db.order.findMany({ where: { orderId: { in: codes } }, select: { orderId: true, status: true } })
    : [];
  const stateOf = Object.fromEntries(orders.map(o => [o.orderId, o.status]));

  let refundKobo = 0, refundCount = 0, unmatched = 0;
  for (const tx of refunds) {
    const state = stateOf[refundOrderCode(tx)];
    if (state && DEAD_STATES.includes(state)) continue;   // never was revenue
    if (!state) unmatched++;
    refundKobo += tx.amount || 0;
    refundCount++;
  }

  const gross = (live._sum.charge || 0) / 100;
  const cost = (live._sum.cost || 0) / 100;
  const costWasted = (dead._sum.cost || 0) / 100;
  const net = gross - refundKobo / 100;

  return {
    gross, refunds: refundKobo / 100, net, cost, costWasted,
    orders: live._count, refundCount, unmatchedRefunds: unmatched,
    grossMargin: gross > 0 ? ((gross - cost) / gross) * 100 : 0,
    netMargin: net > 0 ? ((net - cost - costWasted) / net) * 100 : 0,
  };
}

/**
 * Refund total for a window, already filtered to refunds that reverse revenue.
 * For surfaces that hold their own order aggregate and only need the deduction.
 */
export async function getRevenueRefunds({ from, to, db = prisma } = {}) {
  const { refunds, refundCount, unmatchedRefunds } = await getRevenue({ from, to, db });
  return { refunds, refundCount, unmatchedRefunds };
}
