// Nitro drip-feed calculator
//
// Per-service-type batching: each type has its own batch size, interval, and threshold.
// Layer 1 (always on): Orders above threshold are split into batches at the type's interval.
// Layer 2 (user opt-in): Multi-day drip splits total across 3-30 days.
//   Each day's portion goes through Layer 1 if above threshold.

const DRIP_CONFIG = {
  followers:  { batchSize: 200,  intervalHours: 2, threshold: 200 },
  views:      { batchSize: 2000, intervalHours: 1, threshold: 2000 },
  likes:      { batchSize: 200,  intervalHours: 1, threshold: 200 },
  comments:   { batchSize: 20,   intervalHours: 0.5, threshold: 20 },
  plays:      null,
  engagement: { batchSize: 500,  intervalHours: 1, threshold: 500 },
  reviews:    { batchSize: 5,    intervalHours: 2, threshold: 5 },
};

const DEFAULT_CONFIG = { batchSize: 200, intervalHours: 2, threshold: 200 };

export function getDripConfig(serviceType) {
  const type = (serviceType || '').toLowerCase();
  if (type === 'plays') return null;
  return DRIP_CONFIG[type] || DEFAULT_CONFIG;
}

/**
 * Calculate drip dispatch schedule for an order.
 *
 * @param {number} quantity - total quantity for this day/order
 * @param {number} providerMin - provider's minimum order quantity
 * @param {Date} startTime - when to start (order creation time or day start)
 * @param {string} serviceType - e.g. 'followers', 'views', 'likes'
 * @returns {{ dispatches: { batch: number, quantity: number, scheduledAt: Date }[] } | null}
 */
export function calculateIntradayDrip(quantity, providerMin, startTime, serviceType) {
  const config = getDripConfig(serviceType);
  if (!config) return null;
  if (!quantity || quantity <= 0 || quantity < config.threshold) return null;

  let numBatches = Math.floor(quantity / config.batchSize);
  if (numBatches < 2) return null;

  const minBatch = Math.max(providerMin * 2, 50);
  while (numBatches > 2 && Math.floor(quantity / numBatches) < minBatch) {
    numBatches--;
  }
  if (Math.floor(quantity / numBatches) < providerMin) return null;

  const perBatch = Math.floor(quantity / numBatches);
  const remainder = quantity - perBatch * numBatches;

  const result = [];
  for (let i = 0; i < numBatches; i++) {
    const qty = i === numBatches - 1 ? perBatch + remainder : perBatch;
    const scheduledAt = new Date(startTime.getTime() + i * config.intervalHours * 60 * 60 * 1000);
    result.push({ batch: i + 1, quantity: qty, scheduledAt });
  }

  return { dispatches: result };
}

/**
 * Calculate multi-day drip schedule.
 *
 * @param {number} quantity - total order quantity
 * @param {number} dripDays - number of days (3-30)
 * @param {number} providerMin - provider's minimum order quantity
 * @param {Date} startTime - order creation time
 * @param {string} serviceType - e.g. 'followers', 'views', 'likes'
 */
export function calculateMultiDayDrip(quantity, dripDays, providerMin, startTime, serviceType) {
  const perDay = Math.floor(quantity / dripDays);
  const remainder = quantity - perDay * dripDays;

  const allDispatches = [];

  for (let day = 1; day <= dripDays; day++) {
    const dayQty = day === dripDays ? perDay + remainder : perDay;
    const dayStart = new Date(startTime.getTime() + (day - 1) * 24 * 60 * 60 * 1000);

    const intraday = calculateIntradayDrip(dayQty, providerMin, dayStart, serviceType);

    if (intraday) {
      for (const d of intraday.dispatches) {
        allDispatches.push({ day, batch: d.batch, quantity: d.quantity, scheduledAt: d.scheduledAt });
      }
    } else {
      allDispatches.push({ day, batch: 1, quantity: dayQty, scheduledAt: dayStart });
    }
  }

  return { dispatches: allDispatches };
}
