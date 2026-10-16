/**
 * Made-up guest orders for looking at the order page and the in-card receipt
 * on localhost, where no payment can complete. Never read in production: both
 * callers check NODE_ENV first.
 */
export const SAMPLE_ORDER = { stage: 'AwaitingPayment', orderId: null, service: 'Instagram Followers', tier: 'Standard', platform: 'Instagram', quantity: 500, delivered: 0, link: 'https://instagram.com/adaeze.styles', priceKobo: 1000000, dueKobo: 1000000, payUrl: null, creditKobo: 0, refundsTo: 'code', placedAt: null, completedAt: null, canRefill: false, refillRequested: false };

const PLACED = { orderId: 'NTR-15978', placedAt: '2026-10-16T13:14:00.000Z' };
export const ORDER_PREVIEWS = {
  placing: { stage: 'Placing' },
  delivering: { ...PLACED, stage: 'In progress', delivered: 310 },
  done: { ...PLACED, stage: 'Completed', delivered: 500, canRefill: true },
  partial: { ...PLACED, stage: 'Partial', delivered: 310, creditKobo: 380000 },
  refunded: { ...PLACED, stage: 'Cancelled', creditKobo: 1000000 },
  notPlaced: { stage: 'Failed', creditKobo: 1000000 },
  expired: { stage: 'Expired' },
};

/** The sample in one state ("pay" is the sample as it is), or null for an unknown one. */
export function previewOrder(code, state) {
  if (state !== 'pay' && !ORDER_PREVIEWS[state]) return null;
  return { ...SAMPLE_ORDER, ...(ORDER_PREVIEWS[state] || {}), code };
}
