// House style for everything the outreach bot posts, borrowed wholesale from the
// Pulse digest on WatchTower. That message reads at a glance because every line
// is the same shape — icon, label, bold value, detail in parentheses — and the
// headline is the outcome, not the activity. These messages had drifted into
// three different row shapes, unbolded numbers, and a paragraph of instructions
// stapled to the end of each one.

// Labels are shared rather than redeclared per file: the webhook and the summary
// cron each had their own copy, and they had already drifted.
export const TOUCH_LABEL = {
  day1: 'First Call',
  winback: 'Winback',
  day3: 'Follow-up',
  day7: 'Final Nudge',
  backlog: 'Backlog',
};

// Ordered the way outcomes are worth reading, not alphabetically. The icon is
// the same one the button uses, so a row and a card read as the same thing.
export const METHOD_LABEL = {
  call: ['\u{2705}', 'Reached'],
  callback: ['\u{23F0}', 'Call back'],
  pending: ['\u{1F4DE}', 'No answer'],
  whatsapp: ['\u{1F4AC}', 'WhatsApp sent'],
  unreachable: ['\u{1F4F4}', 'Switched off'],
  not_in_service: ['\u{26D4}', 'Not in service'],
  wrong_number: ['\u{274C}', 'Wrong number'],
  dnc: ['\u{1F6AB}', 'Do not contact'],
  expired: ['\u{1F551}', 'Never worked'],
};

export const methodLabel = (m) => METHOD_LABEL[m]?.[1] || m;
export const touchLabel = (t) => TOUCH_LABEL[t] || t;

// The one row shape. Everything below is built from it.
export function row(icon, label, value, note) {
  return `  ${icon ? `${icon} ` : ''}${label}: <b>${value}</b>${note ? ` (${note})` : ''}`;
}

// A bold heading over its rows. Returns null when there is nothing to show, so
// callers can drop an empty section instead of printing "(none)".
export function block(heading, rows) {
  const lines = rows.filter(Boolean);
  if (!lines.length) return null;
  return `<b>${heading}</b>\n${lines.join('\n')}`;
}

export function message(head, ...sections) {
  return [head, ...sections.filter(Boolean)].join('\n\n');
}

// Counts keyed by outcome, in METHOD_LABEL order, icons and all.
export function outcomeRows(counts) {
  return Object.entries(METHOD_LABEL)
    .filter(([k]) => counts[k])
    .map(([k, [icon, label]]) => row(icon, label, counts[k]));
}

// Counts keyed by touch, biggest first. No icons: a touch has no natural one,
// and inventing five would be noise rather than an anchor.
export function touchRows(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => row('', touchLabel(k), n));
}

export function staffRows(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => row('\u{1F464}', name, n));
}

export const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0);
export const naira = (kobo) => `\u{20A6}${Math.round(kobo / 100).toLocaleString()}`;
