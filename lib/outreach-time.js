// Outreach working hours. Staff work Tue-Sat, 09:00-18:00 WAT (UTC+1), with a
// break from 13:00-14:00. Everything is stored in UTC; these helpers translate
// to and from WAT wall time so callback times read the way staff expect.

const HOUR = 3600000;
const WAT = 1; // hours ahead of UTC
const OPEN = 9;
const CLOSE = 18;

// Two breaks, as minutes from midnight so the half-hour is exact: lunch, and an
// afternoon refresh placed over the 16:00 hour. That hour ran at a 39% reach rate
// against a 61% morning, so it is the one worth interrupting.
const BREAKS = [
  [13 * 60, 14 * 60],
  [16 * 60, 16 * 60 + 30],
];
const WORKING_DAYS = [2, 3, 4, 5, 6]; // Tue-Sat, matching the cron schedules

// Offsets offered when staff pick "Call back".
export const CALLBACK_OFFSETS = [1, 3, 5, 7];

// How many times a call back card is posted before the chain gives up. Shared
// with the recycler, which releases a chain that ended with nobody working it.
export const CALLBACK_MAX_ATTEMPTS = 2;

// A Date whose UTC fields read as WAT wall time, and the way back.
const toWat = (d) => new Date(d.getTime() + WAT * HOUR);
const toUtc = (w) => new Date(w.getTime() - WAT * HOUR);

const pad = (n) => String(n).padStart(2, '0');

// "15:30" in WAT.
export function watLabel(utc) {
  const w = toWat(utc);
  return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

// "15:30" if it lands today, "Tue 09:00" otherwise.
export function watWhen(at, from = new Date()) {
  const a = toWat(at);
  const f = toWat(from);
  const sameDay = a.toISOString().slice(0, 10) === f.toISOString().slice(0, 10);
  if (sameDay) return watLabel(at);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[a.getUTCDay()]} ${watLabel(at)}`;
}

// The next 09:00 WAT that is both in the future and on a working day, so a
// Saturday callback rolls past Sunday and Monday to Tuesday.
export function nextWorkingMorning(from = new Date()) {
  const now = toWat(from);
  const at = new Date(now);
  at.setUTCHours(OPEN, 0, 0, 0);
  while (at <= now || !WORKING_DAYS.includes(at.getUTCDay())) {
    at.setUTCDate(at.getUTCDate() + 1);
    at.setUTCHours(OPEN, 0, 0, 0);
  }
  return toUtc(at);
}

// `offset` hours from `from`, or null when that falls outside working hours.
// Anything landing inside the lunch break is pushed to the end of it.
function sameDayAt(from, offset) {
  const w = toWat(new Date(from.getTime() + offset * HOUR));
  const mins = w.getUTCHours() * 60 + w.getUTCMinutes();
  for (const [start, end] of BREAKS) {
    if (mins >= start && mins < end) {
      w.setUTCHours(Math.floor(end / 60), end % 60, 0, 0);
      break;
    }
  }
  const h = w.getUTCHours();
  if (h < OPEN || h >= CLOSE) return null;
  return toUtc(w);
}

// Past this hour (WAT) there is not enough of the day left to work a fresh card,
// so a dead contact is simply left as a gap rather than being replaced. The slot
// rolls into tomorrow's budget instead of handing over a card nobody can call.
const LAST_REPLACEMENT_HOUR = 17;

export function tooLateForReplacement(now = new Date()) {
  return toWat(now).getUTCHours() >= LAST_REPLACEMENT_HOUR;
}

// An automatic retry `offset` hours out, rolling to the next working morning
// when that lands in the break, after close, or on a non-working day.
export function scheduleRetry(offset = 3, from = new Date()) {
  return sameDayAt(from, offset) || nextWorkingMorning(from);
}

// Picker options: only the offsets that still fit today, plus Tomorrow. Late in
// the day most drop away, so staff never pick a time that silently rolls over.
export function callbackOptions(from = new Date()) {
  const opts = [];
  for (const offset of CALLBACK_OFFSETS) {
    const at = sameDayAt(from, offset);
    if (at) opts.push({ label: watLabel(at), at });
  }
  opts.push({ label: 'Tomorrow', at: nextWorkingMorning(from) });
  return opts;
}
