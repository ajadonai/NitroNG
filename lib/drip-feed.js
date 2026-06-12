// Nitro drip-feed calculator
//
// Two layers:
//   Layer 1 (always on): Orders ≥500 are split into up to 7 dispatches spread across 24 hours.
//   Layer 2 (user opt-in): Multi-day drip splits total across 3-30 days.
//     Each day's portion goes through Layer 1 if ≥500.
//
// Batch size respects provider minimum × 2-3 as a floor.

const INTRADAY_DISPATCHES = 7;
const INTRADAY_HOURS = 24;
const INTRADAY_THRESHOLD = 500;

/**
 * Calculate drip dispatch schedule for an order.
 *
 * @param {number} quantity - total quantity for this day/order
 * @param {number} providerMin - provider's minimum order quantity
 * @param {Date} startTime - when to start (order creation time or day start)
 * @returns {{ dispatches: { batch: number, quantity: number, scheduledAt: Date }[] } | null}
 *   null means no drip needed (quantity <= threshold), dispatch all at once.
 */
export function calculateIntradayDrip(quantity, providerMin, startTime) {
  if (!quantity || quantity <= 0) return null;
  if (quantity < INTRADAY_THRESHOLD) return null;

  const minBatch = Math.max(providerMin * 2, 50);
  let dispatches = INTRADAY_DISPATCHES;

  // Reduce dispatch count if batch size would fall below provider min × 2
  while (dispatches > 2 && Math.floor(quantity / dispatches) < minBatch) {
    dispatches--;
  }

  // If even 2 dispatches is too few per batch, just send it all
  if (Math.floor(quantity / dispatches) < providerMin) return null;

  const perBatch = Math.floor(quantity / dispatches);
  const remainder = quantity - perBatch * dispatches;

  const intervalHours = dispatches > 1 ? INTRADAY_HOURS / (dispatches - 1) : 0;
  const result = [];
  for (let i = 0; i < dispatches; i++) {
    const qty = i === dispatches - 1 ? perBatch + remainder : perBatch;
    const scheduledAt = new Date(startTime.getTime() + i * intervalHours * 60 * 60 * 1000);
    result.push({ batch: i + 1, quantity: qty, scheduledAt });
  }

  return { dispatches: result };
}

/**
 * Calculate multi-day drip schedule.
 * Splits total across days, then applies intraday batching to each day's portion.
 *
 * @param {number} quantity - total order quantity
 * @param {number} dripDays - number of days (3-30)
 * @param {number} providerMin - provider's minimum order quantity
 * @param {Date} startTime - order creation time
 * @returns {{ dispatches: { day: number, batch: number, quantity: number, scheduledAt: Date }[] }}
 */
export function calculateMultiDayDrip(quantity, dripDays, providerMin, startTime) {
  const perDay = Math.floor(quantity / dripDays);
  const remainder = quantity - perDay * dripDays;

  const allDispatches = [];

  for (let day = 1; day <= dripDays; day++) {
    const dayQty = day === dripDays ? perDay + remainder : perDay;
    const dayStart = new Date(startTime.getTime() + (day - 1) * 24 * 60 * 60 * 1000);

    const intraday = calculateIntradayDrip(dayQty, providerMin, dayStart);

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

export { INTRADAY_DISPATCHES, INTRADAY_HOURS, INTRADAY_THRESHOLD };
