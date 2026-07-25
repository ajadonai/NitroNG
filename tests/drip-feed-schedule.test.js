import { describe, it, expect } from 'vitest';
import { calculateMultiDayDrip, buildDripConfig, validateDripConfig, rescheduleRemaining, distributeByCurve, checkDripFeasibility } from '@/lib/drip-feed';

const BASE = new Date('2026-07-23T09:00:00.000Z');
const MIN = 50;
const TYPE = 'followers';
const PLAT = 'instagram';

function totalQty(result) {
  return result.dispatches.reduce((s, d) => s + d.quantity, 0);
}

function dayTotals(result) {
  const m = {};
  for (const d of result.dispatches) m[d.day] = (m[d.day] || 0) + d.quantity;
  return m;
}

function calendarDates(result) {
  const m = {};
  for (const d of result.dispatches) {
    const date = new Date(d.scheduledAt).toISOString().slice(0, 10);
    if (!m[d.day]) m[d.day] = new Set();
    m[d.day].add(date);
  }
  return m;
}

// ── buildDripConfig ─────────────────────────────────────────

describe('buildDripConfig', () => {
  it('returns null for default even with no advanced options', () => {
    expect(buildDripConfig({ curve: 'even' })).toBeNull();
    expect(buildDripConfig({})).toBeNull();
  });

  it('includes curve when not even', () => {
    const c = buildDripConfig({ curve: 'frontload' });
    expect(c).toEqual({ version: 1, curve: 'frontload' });
  });

  it('includes all fields when set', () => {
    const c = buildDripConfig({
      curve: 'rampup',
      startAt: '2026-07-25T08:00:00.000Z',
      timezone: 'Africa/Lagos',
      windowStart: 9,
      windowEnd: 21,
      pauseDay: 3,
    });
    expect(c).toEqual({
      version: 1,
      curve: 'rampup',
      startAt: '2026-07-25T08:00:00.000Z',
      timezone: 'Africa/Lagos',
      window: { startHour: 9, endHour: 21 },
      pauseDay: 3,
    });
  });
});

// ── validateDripConfig ─────────────────────────────────────

describe('validateDripConfig', () => {
  it('returns ok with null config for null/undefined', () => {
    expect(validateDripConfig(null, 5)).toEqual({ ok: true, config: null });
    expect(validateDripConfig(undefined, 5)).toEqual({ ok: true, config: null });
  });

  it('returns ok with null for empty object', () => {
    expect(validateDripConfig({}, 5)).toEqual({ ok: true, config: null });
  });

  it('rejects non-object configs (string, array, number)', () => {
    expect(validateDripConfig('even', 5).ok).toBe(false);
    expect(validateDripConfig([1, 2], 5).ok).toBe(false);
    expect(validateDripConfig(42, 5).ok).toBe(false);
  });

  it('rejects invalid curve', () => {
    const r = validateDripConfig({ curve: 'zigzag' }, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Invalid curve/);
  });

  it('rejects past startAt', () => {
    const r = validateDripConfig({ startAt: '2020-01-01T00:00:00Z' }, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/future/);
  });

  it('rejects invalid timezone', () => {
    const r = validateDripConfig({ timezone: 'Fake/Zone' }, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Invalid timezone/);
  });

  it('rejects window hours out of range', () => {
    expect(validateDripConfig({ windowStart: -1, windowEnd: 17 }, 5).ok).toBe(false);
    expect(validateDripConfig({ windowStart: 9, windowEnd: 25 }, 5).ok).toBe(false);
  });

  it('rejects pauseDay >= dripDays or <= 0', () => {
    expect(validateDripConfig({ pauseDay: 5 }, 5).ok).toBe(false);
    expect(validateDripConfig({ pauseDay: 0 }, 5).ok).toBe(false);
  });

  it('accepts valid advanced config', () => {
    const r = validateDripConfig({ curve: 'frontload', pauseDay: 2 }, 5);
    expect(r.ok).toBe(true);
    expect(r.config).toEqual({ version: 1, curve: 'frontload', pauseDay: 2 });
  });

  it('defaults timezone to Africa/Lagos when window is set', () => {
    const r = validateDripConfig({ windowStart: 9, windowEnd: 17 }, 5);
    expect(r.ok).toBe(true);
    expect(r.config.timezone).toBe('Africa/Lagos');
  });
});

// ── Quantity invariant ──────────────────────────────────────

describe('quantity invariant', () => {
  it.each([
    { qty: 1000, days: 5, curve: 'even' },
    { qty: 1000, days: 5, curve: 'frontload' },
    { qty: 1000, days: 5, curve: 'rampup' },
    { qty: 999, days: 7, curve: 'even' },
    { qty: 999, days: 7, curve: 'frontload' },
    { qty: 100, days: 3, curve: 'rampup' },
    { qty: 50000, days: 30, curve: 'frontload' },
  ])('dispatches total exactly $qty for $days days ($curve)', ({ qty, days, curve }) => {
    const config = curve !== 'even' ? { version: 1, curve } : undefined;
    const result = calculateMultiDayDrip(qty, days, MIN, BASE, TYPE, PLAT, config);
    expect(totalQty(result)).toBe(qty);
  });

  it('dispatches total correctly with a pause day', () => {
    const config = { version: 1, pauseDay: 2 };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    expect(totalQty(result)).toBe(1000);
  });

  it('dispatches total correctly with pause + curve', () => {
    const config = { version: 1, curve: 'frontload', pauseDay: 3 };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    expect(totalQty(result)).toBe(1000);
  });
});

// ── Calendar day separation ─────────────────────────────────

describe('calendar day separation', () => {
  it('each logical day lands on a separate calendar date', () => {
    const config = { version: 1, curve: 'even' };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const dates = calendarDates(result);
    const allDates = new Set();
    for (const dayDates of Object.values(dates)) {
      for (const d of dayDates) {
        expect(allDates.has(d)).toBe(false);
        allDates.add(d);
      }
    }
    expect(allDates.size).toBe(5);
  });

  it('frontload 5-day order spans 5 calendar days', () => {
    const config = { version: 1, curve: 'frontload' };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const dates = calendarDates(result);
    const allDates = new Set();
    for (const dd of Object.values(dates)) for (const d of dd) allDates.add(d);
    expect(allDates.size).toBe(5);
  });

  it('pause creates an actual calendar-day gap', () => {
    const config = { version: 1, pauseDay: 2 };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const dates = calendarDates(result);
    // Day 3 is skipped (pause after day 2), so dates for days 1,2,4,5
    expect(dates[3]).toBeUndefined();
    const allDates = [];
    for (const day of [1, 2, 4, 5]) {
      if (dates[day]) allDates.push(...dates[day]);
    }
    // 4 active days should span 4+ calendar dates (day 3 gap makes it 5 calendar days)
    expect(new Set(allDates).size).toBeGreaterThanOrEqual(4);
  });
});

// ── Curve distribution ──────────────────────────────────────

describe('curve distribution', () => {
  it('even: all days get roughly equal quantity', () => {
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT);
    const vals = Object.values(dayTotals(result));
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it('frontload: day 1 gets the most', () => {
    const config = { version: 1, curve: 'frontload' };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const dt = dayTotals(result);
    expect(dt[1]).toBeGreaterThan(dt[5]);
  });

  it('rampup: last day gets the most', () => {
    const config = { version: 1, curve: 'rampup' };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const dt = dayTotals(result);
    expect(dt[5]).toBeGreaterThan(dt[1]);
  });
});

// ── Pause day ───────────────────────────────────────────────

describe('pause day', () => {
  it('"pause after day N" means day N+1 has no dispatches', () => {
    const config = { version: 1, pauseDay: 3 };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const day4 = result.dispatches.filter(d => d.day === 4);
    expect(day4).toHaveLength(0);
    const day3 = result.dispatches.filter(d => d.day === 3);
    expect(day3.length).toBeGreaterThan(0);
  });

  it('redistributes paused quantity to active days', () => {
    const withPause = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, { version: 1, pauseDay: 3 });
    const without = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT);
    const dtWith = dayTotals(withPause);
    const dtWithout = dayTotals(without);
    expect(dtWith[1]).toBeGreaterThan(dtWithout[1]);
  });

  it('pause at last day-1 skips only the last day', () => {
    const config = { version: 1, pauseDay: 4 };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const dt = dayTotals(result);
    expect(dt[5]).toBeUndefined();
    expect(totalQty(result)).toBe(1000);
  });
});

// ── Provider minimum enforcement ────────────────────────────

describe('provider minimum enforcement', () => {
  it('no active day has quantity below providerMin (except 0)', () => {
    const config = { version: 1, curve: 'frontload' };
    const result = calculateMultiDayDrip(300, 10, 50, BASE, TYPE, PLAT, config);
    const dt = dayTotals(result);
    for (const q of Object.values(dt)) {
      expect(q === 0 || q >= 50).toBe(true);
    }
    expect(totalQty(result)).toBe(300);
  });

  it('merges sub-min days for rampup curve', () => {
    const config = { version: 1, curve: 'rampup' };
    const result = calculateMultiDayDrip(200, 8, 40, BASE, TYPE, PLAT, config);
    const dt = dayTotals(result);
    for (const q of Object.values(dt)) {
      expect(q === 0 || q >= 40).toBe(true);
    }
    expect(totalQty(result)).toBe(200);
  });

  it('preserves frontload curve ordering after min enforcement', () => {
    const amounts = distributeByCurve(300, 10, 'frontload', 0, 50);
    const active = amounts.filter(a => a > 0);
    for (let i = 1; i < active.length; i++) {
      expect(active[i - 1]).toBeGreaterThanOrEqual(active[i]);
    }
  });

  it('preserves rampup curve ordering after min enforcement', () => {
    const amounts = distributeByCurve(200, 8, 'rampup', 0, 40);
    const active = amounts.filter(a => a > 0);
    for (let i = 1; i < active.length; i++) {
      expect(active[i]).toBeGreaterThanOrEqual(active[i - 1]);
    }
  });
});

// ── Scheduled start ─────────────────────────────────────────

describe('scheduled start', () => {
  it('uses startAt from config instead of passed startTime', () => {
    const customStart = '2026-07-25T14:00:00.000Z';
    const config = { version: 1, startAt: customStart };
    const result = calculateMultiDayDrip(500, 3, MIN, BASE, TYPE, PLAT, config);
    const earliest = result.dispatches.reduce((min, d) => d.scheduledAt < min ? d.scheduledAt : min, result.dispatches[0].scheduledAt);
    expect(new Date(earliest).getTime()).toBeGreaterThanOrEqual(new Date(customStart).getTime());
  });
});

// ── Delivery window ─────────────────────────────────────────

describe('delivery window', () => {
  it('constrains dispatch times to the window', () => {
    const config = { version: 1, window: { startHour: 9, endHour: 17 } };
    const earlyStart = new Date('2026-07-23T06:00:00.000Z');
    const result = calculateMultiDayDrip(500, 3, MIN, earlyStart, TYPE, PLAT, config);
    for (const d of result.dispatches) {
      const h = new Date(d.scheduledAt).getUTCHours();
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThan(17);
    }
  });

  it('no two dispatches share the same timestamp', () => {
    const config = { version: 1, window: { startHour: 10, endHour: 14 } };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    const times = result.dispatches.map(d => new Date(d.scheduledAt).getTime());
    expect(new Set(times).size).toBe(times.length);
  });

  it('all dispatches are at or after startAt', () => {
    const start = '2026-07-23T09:00:00.000Z';
    const config = { version: 1, window: { startHour: 0, endHour: 1 }, timezone: 'America/New_York' };
    const result = calculateMultiDayDrip(500, 3, MIN, new Date(start), TYPE, PLAT, config);
    const startMs = new Date(start).getTime();
    for (const d of result.dispatches) {
      expect(new Date(d.scheduledAt).getTime()).toBeGreaterThanOrEqual(startMs);
    }
  });
});

// ── Timezone handling ───────────────────────────────────────

describe('timezone handling', () => {
  it('Africa/Lagos (UTC+1) 09:00 window produces correct local hours', () => {
    const config = { version: 1, window: { startHour: 9, endHour: 17 }, timezone: 'Africa/Lagos' };
    const result = calculateMultiDayDrip(500, 3, MIN, BASE, TYPE, PLAT, config);
    for (const d of result.dispatches) {
      const utcH = new Date(d.scheduledAt).getUTCHours();
      // WAT is UTC+1, so local 9 = UTC 8, local 17 = UTC 16
      expect(utcH).toBeGreaterThanOrEqual(8);
      expect(utcH).toBeLessThan(16);
    }
  });

  it('all timestamps are strictly monotonic', () => {
    const config = { version: 1, window: { startHour: 9, endHour: 17 }, timezone: 'America/New_York' };
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, config);
    for (let i = 1; i < result.dispatches.length; i++) {
      const prev = new Date(result.dispatches[i - 1].scheduledAt).getTime();
      const curr = new Date(result.dispatches[i].scheduledAt).getTime();
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('no duplicate timestamps with narrow window', () => {
    const config = { version: 1, window: { startHour: 0, endHour: 1 }, timezone: 'America/New_York' };
    const result = calculateMultiDayDrip(500, 3, MIN, BASE, TYPE, PLAT, config);
    const times = result.dispatches.map(d => new Date(d.scheduledAt).getTime());
    expect(new Set(times).size).toBe(times.length);
  });
});

// ── Legacy compatibility ────────────────────────────────────

describe('legacy compatibility', () => {
  it('works identically to old behavior when dripConfig is null/undefined', () => {
    const legacy = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT);
    const explicit = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT, null);
    expect(legacy.dispatches.length).toBe(explicit.dispatches.length);
    expect(totalQty(legacy)).toBe(totalQty(explicit));
    for (let i = 0; i < legacy.dispatches.length; i++) {
      expect(legacy.dispatches[i].quantity).toBe(explicit.dispatches[i].quantity);
      expect(legacy.dispatches[i].day).toBe(explicit.dispatches[i].day);
    }
  });

  it('legacy remainder goes to the last day', () => {
    const result = calculateMultiDayDrip(103, 5, 10, BASE, TYPE, PLAT);
    const dt = dayTotals(result);
    const lastDayQty = dt[5];
    const firstDayQty = dt[1];
    expect(lastDayQty - firstDayQty).toBe(103 % 5);
  });

  it('legacy 5-day order spans 5 calendar dates', () => {
    const result = calculateMultiDayDrip(1000, 5, MIN, BASE, TYPE, PLAT);
    const dates = calendarDates(result);
    const allDates = new Set();
    for (const dd of Object.values(dates)) for (const d of dd) allDates.add(d);
    expect(allDates.size).toBe(5);
  });
});

// ── rescheduleRemaining ─────────────────────────────────────

describe('rescheduleRemaining', () => {
  it('returns empty for no pending dispatches', () => {
    expect(rescheduleRemaining([], null)).toEqual([]);
  });

  it('preserves future in-window times', () => {
    const future = new Date(Date.now() + 3600000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: future },
      { id: '2', day: 1, scheduledAt: new Date(future.getTime() + 7200000) },
    ];
    const result = rescheduleRemaining(dispatches, null);
    expect(result[0].scheduledAt.getTime()).toBe(future.getTime());
  });

  it('pushes past-due dispatches to now+interval', () => {
    const past = new Date(Date.now() - 86400000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: past },
      { id: '2', day: 1, scheduledAt: new Date(past.getTime() + 7200000) },
    ];
    const result = rescheduleRemaining(dispatches, null);
    expect(result[0].scheduledAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(result[1].scheduledAt.getTime()).toBeGreaterThan(result[0].scheduledAt.getTime());
  });

  it('respects delivery window when rescheduling', () => {
    const past = new Date(Date.now() - 86400000);
    const config = { window: { startHour: 10, endHour: 14 }, timezone: 'UTC' };
    const dispatches = [
      { id: '1', day: 1, scheduledAt: past },
      { id: '2', day: 1, scheduledAt: new Date(past.getTime() + 3600000) },
    ];
    const result = rescheduleRemaining(dispatches, config);
    for (const r of result) {
      const h = r.scheduledAt.getUTCHours();
      expect(h).toBeGreaterThanOrEqual(10);
      expect(h).toBeLessThan(14);
    }
  });

  it('uses service-specific interval when serviceType is passed', () => {
    const past = new Date(Date.now() - 86400000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: past },
      { id: '2', day: 1, scheduledAt: new Date(past.getTime() + 1800000) },
    ];
    // 'views' has 1h interval vs default 2h
    const resultViews = rescheduleRemaining(dispatches, null, 'views', 'instagram');
    const resultFollowers = rescheduleRemaining(dispatches, null, 'followers', 'instagram');
    const viewGap = resultViews[1].scheduledAt.getTime() - resultViews[0].scheduledAt.getTime();
    const followerGap = resultFollowers[1].scheduledAt.getTime() - resultFollowers[0].scheduledAt.getTime();
    expect(viewGap).toBeLessThan(followerGap);
  });

  it('all rescheduled times are monotonically increasing', () => {
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 3600000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: past },
      { id: '2', day: 1, scheduledAt: new Date(future.getTime() - 1000) },
      { id: '3', day: 2, scheduledAt: new Date(future.getTime() + 1000) },
    ];
    const result = rescheduleRemaining(dispatches, null);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].scheduledAt.getTime()).toBeGreaterThan(result[i - 1].scheduledAt.getTime());
    }
  });

  it('preserves day boundaries across different day groups', () => {
    const past = new Date(Date.now() - 86400000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: past },
      { id: '2', day: 2, scheduledAt: new Date(past.getTime() + 86400000) },
    ];
    const result = rescheduleRemaining(dispatches, null);
    const date1 = result[0].scheduledAt.toISOString().slice(0, 10);
    const date2 = result[1].scheduledAt.toISOString().slice(0, 10);
    expect(date1).not.toBe(date2);
  });
});

// ── distributeByCurve standalone ─────────────────────────────

describe('distributeByCurve', () => {
  it('sum always equals quantity', () => {
    for (const curve of ['even', 'frontload', 'rampup']) {
      const amounts = distributeByCurve(1000, 5, curve, 0, 50);
      expect(amounts.reduce((s, v) => s + v, 0)).toBe(1000);
    }
  });

  it('skipped day gets zero', () => {
    const amounts = distributeByCurve(1000, 5, 'even', 3, 0);
    expect(amounts[3]).toBe(0); // day 4 (pause after 3)
  });

  it('reducing days for frontload preserves decreasing order', () => {
    const amounts = distributeByCurve(150, 5, 'frontload', 0, 40);
    const active = amounts.filter(a => a > 0);
    expect(active.length).toBeGreaterThanOrEqual(2);
    expect(active.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < active.length; i++) {
      expect(active[i - 1]).toBeGreaterThanOrEqual(active[i]);
    }
  });

  it('baseline allocation: all 5 days used when quantity supports it (frontload)', () => {
    const amounts = distributeByCurve(3000, 5, 'frontload', 0, 500);
    const active = amounts.filter(a => a > 0);
    expect(active.length).toBe(5);
    for (const a of active) expect(a).toBeGreaterThanOrEqual(500);
    expect(active[0]).toBeGreaterThan(active[active.length - 1]);
  });

  it('baseline allocation: all 5 days used when quantity supports it (rampup)', () => {
    const amounts = distributeByCurve(3000, 5, 'rampup', 0, 500);
    const active = amounts.filter(a => a > 0);
    expect(active.length).toBe(5);
    for (const a of active) expect(a).toBeGreaterThanOrEqual(500);
    expect(active[active.length - 1]).toBeGreaterThan(active[0]);
  });

  it('baseline allocation: even schedule starts on day 1 when days must be reduced', () => {
    const amounts = distributeByCurve(300, 10, 'even', 0, 50);
    const active = amounts.filter(a => a > 0);
    expect(active.length).toBe(6); // 300/50 = 6 days
    expect(amounts[0]).toBeGreaterThan(0); // day 1 always active
    expect(amounts.reduce((s, v) => s + v, 0)).toBe(300);
  });

  it('3000 over 5 days min 1000: preview matches (3 active days with safe scheduler)', () => {
    const amounts = distributeByCurve(3000, 5, 'even', 0, 1000);
    const active = amounts.filter(a => a > 0);
    expect(active.length).toBe(3);
    for (const a of active) expect(a).toBeGreaterThanOrEqual(1000);
    expect(amounts.reduce((s, v) => s + v, 0)).toBe(3000);
  });
});

// ── Default admin drips (Fix #1) ───────────────────────────

describe('default admin drips use safe scheduler', () => {
  it('default config { version: 1 } enforces provider min', () => {
    const config = { version: 1 };
    const result = calculateMultiDayDrip(3000, 5, 1000, BASE, TYPE, PLAT, config);
    for (const d of result.dispatches) {
      expect(d.quantity).toBeGreaterThanOrEqual(1000);
    }
    expect(totalQty(result)).toBe(3000);
  });

  it('zero-quantity rows never produced with default config', () => {
    const config = { version: 1 };
    const result = calculateMultiDayDrip(500, 60, 50, BASE, TYPE, PLAT, config);
    for (const d of result.dispatches) {
      expect(d.quantity).toBeGreaterThan(0);
    }
  });
});

// ── Cross-day cadence (Fix #2) ─────────────────────────────

describe('cross-day cadence enforcement', () => {
  it('interval between last batch of day 1 and first batch of day 2 respects follower cadence', () => {
    const config = { version: 1, window: { startHour: 9, endHour: 17 }, timezone: 'UTC' };
    const result = calculateMultiDayDrip(2000, 2, MIN, new Date('2026-07-23T09:45:00Z'), TYPE, PLAT, config);
    const times = result.dispatches.map(d => d.scheduledAt.getTime());
    for (let i = 1; i < times.length; i++) {
      const gapMs = times[i] - times[i - 1];
      expect(gapMs).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 1000); // 2h interval for followers
    }
  });

  it('views use 1h interval across day boundaries', () => {
    const config = { version: 1 };
    const result = calculateMultiDayDrip(10000, 2, 100, BASE, 'views', 'instagram', config);
    const times = result.dispatches.map(d => d.scheduledAt.getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    }
  });
});

// ── Recovery scheduling (Fix #3) ───────────────────────────

describe('recovery scheduling', () => {
  it('never moves a row earlier than its original time', () => {
    const future1 = new Date(Date.now() + 86400000);
    const future2 = new Date(Date.now() + 172800000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: new Date(Date.now() - 3600000) },
      { id: '2', day: 2, scheduledAt: future1 },
      { id: '3', day: 3, scheduledAt: future2 },
    ];
    const result = rescheduleRemaining(dispatches, null);
    expect(result[1].scheduledAt.getTime()).toBeGreaterThanOrEqual(future1.getTime());
    expect(result[2].scheduledAt.getTime()).toBeGreaterThanOrEqual(future2.getTime());
  });

  it('1-minute future row pushed to full interval', () => {
    const past = new Date(Date.now() - 3600000);
    const nearFuture = new Date(Date.now() + 60000);
    const dispatches = [
      { id: '1', day: 1, scheduledAt: past },
      { id: '2', day: 1, scheduledAt: nearFuture },
    ];
    const result = rescheduleRemaining(dispatches, null, 'followers', 'instagram');
    const gap = result[1].scheduledAt.getTime() - result[0].scheduledAt.getTime();
    expect(gap).toBeGreaterThanOrEqual(2 * 3600000 - 1000);
  });

  it('day 2→4 gap preserves pause day spacing', () => {
    const past = new Date(Date.now() - 86400000);
    const dispatches = [
      { id: '1', day: 2, scheduledAt: past },
      { id: '2', day: 4, scheduledAt: new Date(past.getTime() + 172800000) },
    ];
    const result = rescheduleRemaining(dispatches, null);
    const date1 = result[0].scheduledAt.toISOString().slice(0, 10);
    const date2 = result[1].scheduledAt.toISOString().slice(0, 10);
    expect(date1).not.toBe(date2);
    const dayGap = (new Date(date2).getTime() - new Date(date1).getTime()) / 86400000;
    expect(dayGap).toBeGreaterThanOrEqual(2);
  });
});

// ── Feasibility check (Fix #6) ─────────────────────────────

describe('checkDripFeasibility', () => {
  it('rejects impossible narrow window config', () => {
    const config = { window: { startHour: 9, endHour: 10 }, pauseDay: 1 };
    const result = checkDripFeasibility(10000, 4, config, 'followers', 'instagram', 50);
    expect(result.feasible).toBe(false);
    expect(result.error).toContain('Cannot deliver');
  });

  it('accepts feasible config', () => {
    const config = { window: { startHour: 9, endHour: 17 } };
    const result = checkDripFeasibility(1000, 5, config, 'followers', 'instagram', 50);
    expect(result.feasible).toBe(true);
  });

  it('accepts when no service config (plays)', () => {
    const result = checkDripFeasibility(1000, 5, null, 'plays', 'instagram', 50);
    expect(result.feasible).toBe(true);
  });
});

// ── Falsey config validation (Fix #10) ─────────────────────

describe('validateDripConfig rejects falsey non-null', () => {
  it('rejects false', () => {
    const r = validateDripConfig(false, 5);
    expect(r.ok).toBe(false);
  });

  it('rejects 0', () => {
    const r = validateDripConfig(0, 5);
    expect(r.ok).toBe(false);
  });

  it('rejects empty string', () => {
    const r = validateDripConfig('', 5);
    expect(r.ok).toBe(false);
  });
});
