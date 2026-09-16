// Turns raw provider service names into reseller-facing display data.
//
// The storefront cleaner (getPublicServiceLabel) strips provider tells but also
// the attributes — which is why 11k services collapse to ~1k labels. A reseller
// choosing between 720 rows all called "Spotify Plays" needs those attributes
// back, in Nitro's own format rather than the provider's.
import { getPublicServiceLabel } from '@/lib/public-service-label';

// Leading colour emoji is MTP's quality grade. Confirmed against cost and refill
// data: blue is the premium band, yellow the budget one. DAO carries no grade —
// null here, and the UI must present ungraded as "not graded", never as "worse".
const GRADES = [
  ['\u{1F535}', 'premium'],
  ['\u{1F7E2}', 'standard'],
  ['\u{1F7E1}', 'basic'],
];

export function gradeOf(rawName) {
  const first = [...String(rawName || '').trim()][0];
  const hit = GRADES.find(([emoji]) => emoji === first);
  return hit ? hit[1] : null;
}

// Attribute extractors, in the order they read best on a row. Each returns a
// short Nitro-styled phrase or null.
const REFILL_RULES = [
  // "Life Time Guarantee" is written with the space as often as without.
  [/life\s*time\s*(guarantee|guaranteed|refill)?/i, 'Lifetime guarantee'],
  // Providers write "[Refill: 30 Days]" and "[Refill: 30D]" interchangeably.
  // Wanting the whole word missed 1,389 live services, every one of which then
  // showed as having no refill at all.
  [/refill:?\s*(\d+)\s*(?:days?|d)\b/i, (m) => `${m[1]}-day refill`],
  [/refill:?\s*(\d+)\s*(?:year|yr)s?/i, (m) => `${m[1]}-year refill`],
  [/refill:?\s*no\b|\bno\s*refill/i, 'No refill'],
  // "30 Days Refill" — the number first, the word after. The stray space in
  // `day s?` meant the plural never matched, so only "30 Day Refill" did.
  [/(\d+)\s*[- ]?\s*days?\s*refill/i, (m) => `${m[1]}-day refill`],
  [/no\s*refill/i, 'No refill'],
  // "No Drop" and "Non Drop" are the same promise spelled two ways.
  [/\bnon?[- ]?drop\b/i, 'Non-drop'],
];

const SPEED_RE = /(?:speed[:\s]*)?(\d+(?:[.,]\d+)?[km]?\s*[-–]\s*\d+(?:[.,]\d+)?[km]?)\s*\/\s*day/i;
const QUALIFIER_RULES = [
  [/instant\s*(start)?/i, 'Instant'],
  [/start\s*time:?\s*([\d.,-]+\s*(?:min|mins|minutes|h|hr|hrs|hour|hours|day|days))/i, (m) => `Starts in ${m[1].replace(/\s+/g, ' ')}`],
  [/drop\s*([\d.,-]+%)/i, (m) => `Drop ${m[1]}`],
  [/\bnigeria(n)?\b|\b🇳🇬/i, 'Nigerian'],
  [/\bworldwide\b|\bglobal\b/i, 'Worldwide'],
  [/\breal\b/i, 'Real'],
  // Providers write the top grade three ways. It has to be its own rule and it
  // has to come first: "Ultra High Quality" also satisfies the plain rule
  // below, and a row is not both grades.
  //
  // Spelled out here rather than abbreviated. This vocabulary is what the
  // reseller API prints and what a reseller's own storefront repeats, and
  // "UHQ" is a term of art a customer of theirs would not know. The full-list
  // row abbreviates it for a narrow screen; that is a display decision and it
  // lives with the display.
  [/\bultra\s*(?:hq|high\s*quality)\b|\buhq\b/i, 'Ultra high quality'],
  [/\bhq\b|high\s*quality/i, 'High quality'],
  [/premium\s*accounts?/i, 'Premium accounts'],
  [/royalt(y|ies)\s*eligible/i, 'Royalties eligible'],
];

/** What a row is given when the provider promised no start time of its own. */
const DEFAULT_START = '0-24 hours';
/** Does this row already say when it starts? */
const SAYS_WHEN = (a) => a === 'Instant' || a.startsWith('Starts in');

export function serviceAttributes(rawName) {
  const name = String(rawName || '');
  const attrs = [];

  for (const [re, out] of REFILL_RULES) {
    const m = name.match(re);
    if (m) { attrs.push(typeof out === 'function' ? out(m) : out); break; }
  }
  const speed = name.match(SPEED_RE);
  if (speed) attrs.push(`${speed[1].replace(/\s+/g, '').toUpperCase()}/day`);
  for (const [re, out] of QUALIFIER_RULES) {
    const m = name.match(re);
    if (m) attrs.push(typeof out === 'function' ? out(m) : out);
  }
  // Every row says when it starts. A provider that promises nothing is not
  // faster than one that promises a day — silence just reads as unknown, and
  // next to a row marked Instant it reads as worse than it is. A day is the
  // outside edge these services actually run to, so say that.
  if (!attrs.some(SAYS_WHEN)) attrs.push(DEFAULT_START);
  const out = [...new Set(attrs)];
  // "Ultra High Quality" matched the plain grade rule too. The higher grade
  // wins: a row carrying both badges reads as a contradiction.
  return out.includes('Ultra high quality') ? out.filter(a => a !== 'High quality') : out;
}

// When the storefront cleaner cannot recognise the platform it returns a generic
// "<Platform> Service" label, which turns 589 perfectly good services into one
// indistinguishable heap. Rather than surrender, scrub the raw name: strip emoji
// and provider tells, restyle the pipe format, keep the words that distinguish.
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\uFE0E\uFE0F\u20E3]/gu;
const TELL_RE = /\b(mtp|daosmm|dao|jap|morethanpanel|just\s*another\s*panel|exclusive|contact\s*for\s*api\s*prices?|new!?)\b/gi;

function scrubbedLabel(rawName) {
  const parts = String(rawName || '')
    .replace(EMOJI_RE, '')
    .replace(TELL_RE, '')
    // [Refill: 30 Days] [Max: 3K] [Start Time: 1 Hour] carry facts the attributes already say
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[|~]/)
    .map(seg => seg.replace(/\s+/g, ' ').trim())
    // Max/min segments duplicate the min-max column; speed is already an attribute.
    .filter(seg => seg && !/^max\s*[\d.,km]+$/i.test(seg));
  return parts.join(' \u{00B7} ').slice(0, 80).replace(/\s*\u{00B7}\s*$/, '');
}

/**
 * Display name plus the attributes that distinguish it from its neighbours.
 * The first two attributes ride on the label itself, which is what breaks the
 * 720-identical-"Spotify Plays" problem; the rest belong in the detail drawer.
 */
export function formatResellerService(rawName, category) {
  let base = getPublicServiceLabel(rawName, category);
  // "<Anything> Service" is the cleaner's shrug. The scrubbed raw name says more.
  if (/\bService$/.test(base)) {
    const scrubbed = scrubbedLabel(rawName);
    if (scrubbed.length > 3) base = scrubbed;
  }
  const attrs = serviceAttributes(rawName);
  // The start-time default rides in the attributes, where it is a badge, but
  // never in the label: "Instagram Followers \u{2014} 0-24 hours" reads as the name
  // of the product, and that name is what a reseller's own storefront prints.
  const stated = attrs.filter(a => a !== DEFAULT_START);
  const label = stated.length && !base.includes('\u{00B7}')
    ? `${base} \u{2014} ${stated.slice(0, 3).join(', ')}` : base;
  return { label, base, attrs, grade: gradeOf(rawName) };
}

/**
 * Two rows in one category must not read the same. Where labels collide, add
 * the next attributes; where they still collide, a tail from the scrubbed raw
 * name with flags, brackets and already-said words removed. Mutates `rows`
 * (each needs `category`, `label`, `attrs`, `_raw`) and drops `_raw`.
 */
export function dedupeCategoryLabels(rows) {
  const seen = new Map();
  for (const r of rows) seen.set(`${r.category}|${r.label}`, (seen.get(`${r.category}|${r.label}`) || 0) + 1);
  for (const r of rows) {
    if (seen.get(`${r.category}|${r.label}`) > 1) {
      // Same filter the label uses, so these are attributes 4 and 5 of the same
      // stated list — and a default nearly every row carries could not break a
      // tie anyway: both sides would gain it and still read alike.
      const extra = (r.attrs || []).filter(a => a !== DEFAULT_START).slice(3, 5);
      const said = new Set(r.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const scrub = String(r._raw || '').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F]/gu, '').replace(/\[[^\]]*\]/g, ' ').replace(/[|~]/g, ' ');
      const tail = extra.length ? extra.join(', ') : scrub.split(/\s+/).filter(w => w && !said.has(w.toLowerCase().replace(/[^a-z0-9]/g, ''))).join(' ').trim().slice(0, 36);
      if (tail && !r.label.includes(tail)) r.label = `${r.label} \u{00B7} ${tail}`.slice(0, 80).replace(/[\s\u{00B7},-]+$/u, '');
    }
    delete r._raw;
  }
  return rows;
}
