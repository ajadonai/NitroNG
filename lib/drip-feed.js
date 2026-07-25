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

const PLATFORM_OVERRIDES = {
  telegram:  { batchSize: 1000, intervalHours: 3, threshold: 1000 },
  discord:   { batchSize: 1000, intervalHours: 3, threshold: 1000 },
};

const DEFAULT_CONFIG = { batchSize: 200, intervalHours: 2, threshold: 200 };

const VALID_CURVES = ['even', 'frontload', 'rampup'];
const MAX_DRIP_DAYS = 60;

export function getDripConfig(serviceType, platform) {
  const type = (serviceType || '').toLowerCase();
  if (type === 'plays') return null;
  const plat = (platform || '').toLowerCase();
  if (PLATFORM_OVERRIDES[plat]) return PLATFORM_OVERRIDES[plat];
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
export function calculateIntradayDrip(quantity, providerMin, startTime, serviceType, platform) {
  const config = getDripConfig(serviceType, platform);
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

// ── Timezone helpers ────────────────────────────────────────

function getLocalParts(date, tz) {
  if (!tz) {
    return {
      year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
      day: date.getUTCDate(), hour: date.getUTCHours(),
      minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    };
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    });
    const m = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type === 'year') m.year = Number(p.value);
      else if (p.type === 'month') m.month = Number(p.value);
      else if (p.type === 'day') m.day = Number(p.value);
      else if (p.type === 'hour') m.hour = Number(p.value) % 24;
      else if (p.type === 'minute') m.minute = Number(p.value);
      else if (p.type === 'second') m.second = Number(p.value);
    }
    return m;
  } catch {
    return {
      year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
      day: date.getUTCDate(), hour: date.getUTCHours(),
      minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    };
  }
}

function utcOffsetMs(date, tz) {
  const p = getLocalParts(date, tz);
  const localMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return localMs - date.getTime();
}

function localToUtc(year, month, day, hour, minute, tz) {
  if (!tz) return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const approx = new Date(targetLocalMs);
  const offset1 = utcOffsetMs(approx, tz);
  const guess = new Date(targetLocalMs - offset1);
  const offset2 = utcOffsetMs(guess, tz);
  if (offset1 !== offset2) return new Date(targetLocalMs - offset2);
  return guess;
}

function addLocalDays(date, days, tz) {
  if (days === 0) return new Date(date);
  if (!tz) return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  const p = getLocalParts(date, tz);
  return localToUtc(p.year, p.month, p.day + days, p.hour, p.minute, tz);
}

function localHour(date, tz) {
  return getLocalParts(date, tz).hour;
}

function setLocalHour(date, hour, tz) {
  const p = getLocalParts(date, tz);
  return localToUtc(p.year, p.month, p.day, hour, 0, tz);
}

function nextDayAtLocalHour(date, hour, tz) {
  const p = getLocalParts(date, tz || 'UTC');
  return localToUtc(p.year, p.month, p.day + 1, hour, 0, tz || 'UTC');
}

// ── Delivery window ─────────────────────────────────────────

export function isInWindow(date, window, tz) {
  if (!window) return true;
  const { startHour, endHour } = window;
  if (startHour === endHour) return true;
  const p = getLocalParts(date, tz);
  const mins = p.hour * 60 + p.minute;
  const startMins = startHour * 60;
  const endMins = endHour * 60;
  if (startMins < endMins) return mins >= startMins && mins < endMins;
  return mins >= startMins || mins < endMins;
}

export function snapToWindow(date, window, tz) {
  if (!window) return date;
  const { startHour, endHour } = window;
  if (startHour === endHour) return date;
  if (isInWindow(date, window, tz)) return date;
  // Try startHour on the same day
  let snapped = setLocalHour(date, startHour, tz);
  if (snapped > date && isInWindow(snapped, window, tz)) return snapped;
  // DST gap: startHour may not exist today — try startHour + 1
  if (snapped <= date || !isInWindow(snapped, window, tz)) {
    const gap = setLocalHour(date, startHour + 1, tz);
    if (gap > date && isInWindow(gap, window, tz)) return gap;
  }
  // Next day at startHour
  const nextDay = nextDayAtLocalHour(date, startHour, tz);
  if (isInWindow(nextDay, window, tz)) return nextDay;
  return nextDayAtLocalHour(date, startHour + 1, tz);
}

export function windowHours(window) {
  if (!window) return 24;
  const { startHour, endHour } = window;
  if (startHour === endHour) return 24;
  return startHour < endHour ? endHour - startHour : 24 - startHour + endHour;
}

function nextWindowSlot(prevTime, intervalMs, window, tz) {
  const candidate = new Date(prevTime.getTime() + intervalMs);
  const result = snapToWindow(candidate, window, tz);
  if (result <= prevTime) {
    return snapToWindow(new Date(prevTime.getTime() + Math.max(intervalMs, 60000)), window, tz);
  }
  return result;
}

// ── Curve distribution ──────────────────────────────────────

export function distributeByCurve(quantity, dripDays, curve, pauseAfterDay, providerMin) {
  const skipDay = pauseAfterDay > 0 && pauseAfterDay < dripDays ? pauseAfterDay + 1 : 0;
  const activeFlags = Array.from({ length: dripDays }, (_, i) => i + 1 !== skipDay);
  let activeDays = activeFlags.filter(Boolean).length;
  if (activeDays === 0) return Array.from({ length: dripDays }, () => 0);

  // Reduce active days from the end when quantity can't meet providerMin for all
  if (providerMin > 0 && quantity < activeDays * providerMin) {
    while (activeDays > 1 && quantity < activeDays * providerMin) {
      for (let i = dripDays - 1; i >= 0; i--) {
        if (activeFlags[i]) { activeFlags[i] = false; activeDays--; break; }
      }
    }
  }

  // Baseline: each active day gets at least providerMin, then remainder by curve
  const baseline = providerMin > 0 && activeDays > 0
    ? Math.min(providerMin, Math.floor(quantity / activeDays)) : 0;
  const remainder = quantity - baseline * activeDays;

  const activeIndices = [];
  activeFlags.forEach((a, i) => { if (a) activeIndices.push(i); });

  const weights = activeFlags.map((a, i) => {
    if (!a) return 0;
    const rank = activeIndices.indexOf(i);
    if (curve === 'frontload') return activeIndices.length - rank;
    if (curve === 'rampup') return rank + 1;
    return 1;
  });

  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const result = activeFlags.map((a, i) => {
    if (!a) return 0;
    return baseline + (totalWeight > 0 && remainder > 0
      ? Math.floor(remainder * weights[i] / totalWeight) : 0);
  });

  let assigned = result.reduce((s, v) => s + v, 0);
  for (let i = result.length - 1; i >= 0 && assigned < quantity; i--) {
    if (activeFlags[i]) { result[i] += quantity - assigned; assigned = quantity; }
  }
  return result;
}

/**
 * Validate and normalize a dripConfig from the client. Returns { ok, config, error }.
 */
export function validateDripConfig(raw, dripDays) {
  if (raw === null || raw === undefined) return { ok: true, config: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'dripConfig must be a plain object' };
  if (Object.keys(raw).length === 0) return { ok: true, config: null };

  const config = { version: 1 };
  const curve = raw.curve || 'even';
  if (!VALID_CURVES.includes(curve)) return { ok: false, error: `Invalid curve: ${curve}. Must be one of: ${VALID_CURVES.join(', ')}` };
  if (curve !== 'even') config.curve = curve;

  if (raw.startAt != null) {
    const startDate = new Date(raw.startAt);
    if (isNaN(startDate.getTime())) return { ok: false, error: 'Invalid startAt date' };
    if (startDate.getTime() < Date.now() - 60000) return { ok: false, error: 'Scheduled start must be in the future' };
    config.startAt = startDate.toISOString();
  }

  const tz = raw.timezone || raw.tz;
  if (tz) {
    try { Intl.DateTimeFormat('en-US', { timeZone: tz }); config.timezone = tz; }
    catch { return { ok: false, error: `Invalid timezone: ${tz}` }; }
  }
  if (config.startAt && !config.timezone) config.timezone = 'Africa/Lagos';

  if (raw.windowStart != null || raw.windowEnd != null || raw.window) {
    const startHour = raw.window?.startHour ?? raw.windowStart;
    const endHour = raw.window?.endHour ?? raw.windowEnd;
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) return { ok: false, error: 'Window startHour must be 0–23' };
    if (!Number.isInteger(endHour) || endHour < 0 || endHour > 23) return { ok: false, error: 'Window endHour must be 0–23' };
    if (startHour !== endHour) {
      config.window = { startHour, endHour };
      if (!config.timezone) config.timezone = 'Africa/Lagos';
    }
  }

  if (raw.pauseDay != null) {
    const p = Number(raw.pauseDay);
    if (!Number.isInteger(p) || p < 1 || p >= dripDays) return { ok: false, error: `Pause day must be between 1 and ${dripDays - 1}` };
    config.pauseDay = p;
  }

  const hasAdvanced = config.curve || config.startAt || config.window || config.pauseDay;
  return { ok: true, config: hasAdvanced ? config : null };
}

/**
 * Build a dripConfig object from admin UI inputs. Lightweight client-side builder.
 */
export function buildDripConfig({ curve, startAt, timezone, windowStart, windowEnd, pauseDay }) {
  const config = { version: 1 };
  let hasAdvanced = false;
  if (curve && curve !== 'even') { config.curve = curve; hasAdvanced = true; }
  if (startAt) { config.startAt = startAt; hasAdvanced = true; }
  if (timezone) config.timezone = timezone;
  if (windowStart != null && windowEnd != null && !(windowStart === 0 && windowEnd === 0)) {
    config.window = { startHour: windowStart, endHour: windowEnd };
    hasAdvanced = true;
  }
  if (pauseDay != null && pauseDay > 0) { config.pauseDay = pauseDay; hasAdvanced = true; }
  if (!hasAdvanced) return null;
  return config;
}

/**
 * Calculate multi-day drip schedule (legacy path — no dripConfig).
 * Remainder goes to the last day, preserving original behavior.
 */
function calculateMultiDayDripLegacy(quantity, dripDays, providerMin, startTime, serviceType, platform) {
  const perDay = Math.floor(quantity / dripDays);
  const remainder = quantity - perDay * dripDays;

  const allDispatches = [];

  for (let day = 1; day <= dripDays; day++) {
    const dayQty = day === dripDays ? perDay + remainder : perDay;
    const dayStart = new Date(startTime.getTime() + (day - 1) * 24 * 60 * 60 * 1000);

    const intraday = calculateIntradayDrip(dayQty, providerMin, dayStart, serviceType, platform);

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

/**
 * Calculate multi-day drip schedule.
 *
 * @param {number} quantity - total order quantity
 * @param {number} dripDays - number of days (2-60)
 * @param {number} providerMin - provider's minimum order quantity
 * @param {Date} startTime - order creation time
 * @param {string} serviceType - e.g. 'followers', 'views', 'likes'
 * @param {string} platform
 * @param {object} [dripConfig] - optional advanced config from Order.dripConfig
 */
export function calculateMultiDayDrip(quantity, dripDays, providerMin, startTime, serviceType, platform, dripConfig) {
  if (!dripConfig) return calculateMultiDayDripLegacy(quantity, dripDays, providerMin, startTime, serviceType, platform);

  const curve = dripConfig.curve || 'even';
  const pauseAfterDay = dripConfig.pauseDay || 0;
  const window = dripConfig.window || null;
  const tz = dripConfig.timezone || null;
  const baseStart = dripConfig.startAt ? new Date(dripConfig.startAt) : startTime;

  const clampedDays = Math.min(Math.max(dripDays, 2), MAX_DRIP_DAYS);
  const dayQuantities = distributeByCurve(quantity, clampedDays, curve, pauseAfterDay, providerMin);

  const allDispatches = [];
  const dripType = getDripConfig(serviceType, platform);
  const intervalMs = (dripType?.intervalHours || 2) * 60 * 60 * 1000;
  let lastScheduled = null;

  for (let day = 1; day <= clampedDays; day++) {
    const dayQty = dayQuantities[day - 1];
    if (dayQty === 0) continue;

    // Anchor to this day's calendar date, at window start if applicable
    const dayAnchor = snapToWindow(addLocalDays(baseStart, day - 1, tz), window, tz);
    const intraday = calculateIntradayDrip(dayQty, providerMin, dayAnchor, serviceType, platform);

    if (intraday) {
      for (let i = 0; i < intraday.dispatches.length; i++) {
        const d = intraday.dispatches[i];
        let scheduled;
        if (i === 0) {
          if (!lastScheduled) {
            scheduled = dayAnchor;
          } else {
            const minByInterval = new Date(lastScheduled.getTime() + intervalMs);
            scheduled = dayAnchor >= minByInterval
              ? dayAnchor
              : snapToWindow(minByInterval, window, tz);
          }
        } else {
          scheduled = nextWindowSlot(lastScheduled, intervalMs, window, tz);
        }
        if (lastScheduled && scheduled <= lastScheduled) {
          scheduled = nextWindowSlot(lastScheduled, intervalMs, window, tz);
        }
        allDispatches.push({ day, batch: d.batch, quantity: d.quantity, scheduledAt: scheduled });
        lastScheduled = scheduled;
      }
    } else {
      let scheduled;
      if (!lastScheduled) {
        scheduled = dayAnchor;
      } else {
        const minByInterval = new Date(lastScheduled.getTime() + intervalMs);
        scheduled = dayAnchor >= minByInterval
          ? dayAnchor
          : snapToWindow(minByInterval, window, tz);
      }
      if (lastScheduled && scheduled <= lastScheduled) {
        scheduled = nextWindowSlot(lastScheduled, intervalMs, window, tz);
      }
      allDispatches.push({ day, batch: 1, quantity: dayQty, scheduledAt: scheduled });
      lastScheduled = scheduled;
    }
  }

  return { dispatches: allDispatches };
}

/**
 * Reschedule remaining pending dispatches after an overdue batch completes.
 * Preserves delivery windows, day boundaries, and service-specific intervals.
 */
export function rescheduleRemaining(pendingDispatches, dripConfig, serviceType, platform) {
  if (!pendingDispatches.length) return [];
  const cfg = getDripConfig(serviceType, platform);
  const intervalMs = ((cfg?.intervalHours) || 2) * 60 * 60 * 1000;
  const window = dripConfig?.window || null;
  const tz = dripConfig?.timezone || null;
  const now = new Date();

  const result = [];
  let prev = now;
  let prevDay = null;

  for (const dispatch of pendingDispatches) {
    const original = new Date(dispatch.scheduledAt);
    const day = dispatch.day;

    let lowerBound;
    if (prevDay === null) {
      lowerBound = new Date(Math.max(now.getTime(), original.getTime()));
    } else {
      lowerBound = new Date(Math.max(
        now.getTime(),
        original.getTime(),
        prev.getTime() + intervalMs,
      ));
      // Day boundary: maintain actual logical-day gap
      if (day !== prevDay) {
        const dayDelta = day - prevDay;
        const dayBoundary = snapToWindow(addLocalDays(prev, dayDelta, tz), window, tz);
        if (dayBoundary.getTime() > lowerBound.getTime()) lowerBound = dayBoundary;
      }
    }

    let scheduled = snapToWindow(lowerBound, window, tz);
    if (scheduled <= prev) scheduled = nextWindowSlot(prev, intervalMs, window, tz);

    result.push({ id: dispatch.id, scheduledAt: scheduled });
    prev = scheduled;
    prevDay = day;
  }
  return result;
}

export function checkDripFeasibility(quantity, dripDays, dripConfig, serviceType, platform, providerMin) {
  const cfg = getDripConfig(serviceType, platform);
  if (!cfg) return { feasible: true };
  const intervalHours = cfg.intervalHours || 2;
  const pauseDay = dripConfig?.pauseDay || 0;
  const activeDays = dripDays - (pauseDay > 0 && pauseDay < dripDays ? 1 : 0);
  if (activeDays < 1) return { feasible: false, error: 'No active delivery days' };

  const hours = windowHours(dripConfig?.window);
  const slotsPerDay = Math.max(1, Math.ceil(hours / intervalHours));
  const maxPerSlot = Math.max(cfg.batchSize || 200, providerMin);
  const minBatchesNeeded = Math.ceil(quantity / maxPerSlot);

  if (minBatchesNeeded > slotsPerDay * activeDays) {
    return {
      feasible: false,
      error: `Cannot deliver ${quantity.toLocaleString()} units in ${activeDays} day${activeDays > 1 ? 's' : ''} with a ${hours}h window. Needs ~${minBatchesNeeded} batches but only ${slotsPerDay * activeDays} slots fit. Widen the window or add more days.`,
    };
  }
  return { feasible: true };
}
