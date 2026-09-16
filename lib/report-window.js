/**
 * What a day is in the admin, and what window a range covers.
 *
 * One module, because the alternative is what we had: every reporting page
 * deciding for itself, and no two agreeing. The tracking panel, the analytics
 * page and the finance page each answered "the last 30 days" differently, and
 * the finance page answered it differently again depending on whether you used
 * a preset or the date picker beside it.
 *
 * **Days are cut in Lagos.** `createdAt` is a plain timestamp, so anything that
 * truncates it naively cuts the day at midnight UTC — 1am in Lagos. 1,935 of
 * 44,500 clicks, 4.3%, land in that hour, and every one of them was filed on
 * the day before the one it happened on. A campaign pushed at 1:30am on Friday
 * was reported on Thursday. Nothing in this admin is read by anyone outside
 * Nigeria, so Lagos is simply what a day means here.
 *
 * Its own module because routes compute these and tests assert on them, and
 * because every fault this replaces came from the window being implied rather
 * than stated. Five of the seven items in the 15 Sep tracking review were one
 * bug wearing different clothes: nobody agreed what "the last 30 days" meant.
 *
 *   — It meant `now - 30 * 86400000`, which lands mid-afternoon on the 31st
 *     calendar date back. "Last 30 days" drew 31 bars and the first was a stub:
 *     on alabi-ad the leftmost bar was 65 clicks against a 408 average, a 6×
 *     dip that never happened.
 *   — It meant whatever days the database happened to return. `GROUP BY DATE()`
 *     emits no row for a day with no clicks, so Mide Expansion's month drew ten
 *     bars and called it thirty; three real weeks of silence were not drawn as
 *     quiet, they were not drawn at all.
 *   — At 24h it meant the hour *digit*, 0 through 23, so a window opening at
 *     20:00 put yesterday's 21:00–23:00 at the far right, after today's 20:00.
 *
 * So the window is built here, snapped, and handed to both the SQL and the
 * zero-fill. Bar count always equals slot count, and slot N is the same instant
 * in every series on the chart.
 *
 * `windowFor` serves the charts, which need slots and a bucket size.
 * `reportWindow` serves the pages that only need a pair of instants, and it
 * defers to `windowFor` for the day ranges so the two can never drift.
 */

export const LAGOS = 'Africa/Lagos';

/** Bucket size per range, and how many slots that range holds. */
export const RANGES = {
  '24h': { bucket: 'hour', slots: 24, label: 'Last 24 hours' },
  '7d': { bucket: 'day', slots: 7, label: 'Last 7 days' },
  '30d': { bucket: 'day', slots: 30, label: 'Last 30 days' },
  '90d': { bucket: 'day', slots: 90, label: 'Last 90 days' },
  // Weeks, not days: 92 daily bars is noise where 13 weekly bars is a trend,
  // and All has to stay readable for a link that has been running a year.
  all: { bucket: 'week', slots: null, label: 'All time' },
};

export const RANGE_KEYS = Object.keys(RANGES);
export const isRange = (r) => Object.hasOwn(RANGES, String(r));

/** Lagos offset in minutes for a given instant. +60 all year — Nigeria has no DST. */
function lagosOffsetMinutes(at) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/**
 * The instant that begins the Lagos hour, day or week containing `at`.
 *
 * Weeks start on Monday, because that is where Postgres `date_trunc('week')`
 * cuts them. The two have to agree exactly or the zero-fill lines up against
 * nothing: the first All-time chart drew fourteen weekly slots, every one of
 * them empty, over a link with 30,699 clicks.
 */
export function snap(at, bucket) {
  const off = lagosOffsetMinutes(at) * 60000;
  const local = at.getTime() + off;
  if (bucket === 'week') {
    const day = new Date(Math.floor(local / 86400000) * 86400000);
    // getUTCDay on the shifted value is the Lagos weekday. Sunday is 0, and
    // Postgres counts the week from Monday, so Sunday walks back six days.
    const back = (day.getUTCDay() + 6) % 7;
    return new Date(day.getTime() - back * 86400000 - off);
  }
  const unit = bucket === 'hour' ? 3600000 : 86400000;
  return new Date(Math.floor(local / unit) * unit - off);
}

/**
 * `{ start, end, bucket, slots, stepMs }` for a range.
 *
 * `end` is the start of the slot in progress, so the window covers whole slots
 * and the live one is drawn as in-progress rather than as a collapse. `firstAt`
 * is only consulted for "all", where the window begins at the link's first
 * click — an all-time chart of a link that launched in July should not open in
 * 1970.
 */
export function windowFor(range, { now = new Date(), firstAt = null } = {}) {
  const spec = RANGES[range] || RANGES['7d'];
  const { bucket } = spec;
  const stepMs = bucket === 'hour' ? 3600000 : bucket === 'week' ? 604800000 : 86400000;
  const current = snap(now, bucket === 'hour' ? 'hour' : 'day');

  if (bucket === 'week') {
    // Both edges land on a Monday, so every slot is exactly one Postgres week.
    const firstWeek = snap(firstAt ? new Date(firstAt) : now, 'week');
    const thisWeek = snap(now, 'week');
    const slots = Math.max(1, Math.round((thisWeek.getTime() - firstWeek.getTime()) / stepMs) + 1);
    return { start: firstWeek, end: new Date(thisWeek.getTime() + stepMs), bucket, slots, stepMs };
  }

  const end = new Date(current.getTime() + stepMs);
  return { start: new Date(end.getTime() - spec.slots * stepMs), end, bucket, slots: spec.slots, stepMs };
}

/** The Lagos month or year containing `at`, as the instant it begins. */
function lagosPeriodStart(at, { months = 0, unit = 'month' } = {}) {
  const off = lagosOffsetMinutes(at) * 60000;
  const local = new Date(at.getTime() + off);
  const y = local.getUTCFullYear();
  const m = unit === 'year' ? 0 : local.getUTCMonth() + months;
  return new Date(Date.UTC(y, m, 1) - off);
}

/**
 * `{ since, until }` for an admin reporting range — `until` always exclusive.
 *
 * The ranges the finance pages offer, resolved in one place so the analytics
 * page and the financials page cannot answer the same question differently.
 * They did: both counted `now - 30 * 86400000`, which lands mid-afternoon on
 * the 31st date back, so "Last 30 days" quietly meant thirty days and one
 * afternoon, the oldest day was a fragment, and reloading the page an hour
 * later changed the total. Worse, the date picker sitting beside those presets
 * cut its days in UTC on one page and in Lagos on the other, so the same
 * fortnight gave two answers depending on how you asked for it.
 *
 * Whole Lagos days now, ending with today in progress — a finance page has to
 * include today, so the last day is partial by nature rather than by accident.
 *
 * `since` is null for "all", which every caller already treats as no filter.
 */
export function reportWindow(range, { now = new Date(), from = null, to = null } = {}) {
  // An explicit date pair beats the preset, and both edges are Lagos days: the
  // from-date from its first moment, the to-date through its last.
  if (from) {
    const since = snap(new Date(from), 'day');
    return { since, until: to ? new Date(snap(new Date(to), 'day').getTime() + 86400000) : null };
  }
  if (range === 'all') return { since: null, until: null };
  if (range === 'month') return { since: lagosPeriodStart(now), until: null };
  if (range === 'lastmonth') {
    return { since: lagosPeriodStart(now, { months: -1 }), until: lagosPeriodStart(now) };
  }
  if (range === 'year') return { since: lagosPeriodStart(now, { unit: 'year' }), until: null };

  // Everything else is a slot range, so it comes from the same function the
  // charts use. "Last 7 days" means the same seven days on every page.
  const win = windowFor(isRange(range) ? range : '30d', { now });
  return { since: win.start, until: win.end };
}

/**
 * Rows keyed by bucket instant, spread across every slot in the window.
 *
 * This is the whole of item 03. A chart plots the rows it was given, and the
 * database only sends rows that exist — so the absence of a day was being drawn
 * as the absence of a bar rather than as a zero. Every slot is emitted now,
 * whether anything happened in it or not.
 */
export function fill(win, rows, keys = ['clicks']) {
  const byBucket = new Map();
  for (const r of rows) {
    const t = new Date(r.bucket).getTime();
    byBucket.set(t, r);
  }
  const out = [];
  for (let i = 0; i < win.slots; i++) {
    const at = win.start.getTime() + i * win.stepMs;
    const hit = byBucket.get(at);
    const slot = { at: new Date(at).toISOString() };
    for (const k of keys) slot[k] = Number(hit?.[k] || 0);
    // The last slot is the one still being written to.
    if (i === win.slots - 1) slot.partial = true;
    out.push(slot);
  }
  return out;
}
