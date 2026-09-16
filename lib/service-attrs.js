// What kind of fact a service attribute is, so a row can colour it by meaning
// rather than print five kinds of thing in one grey.
//
// Its own module, with no imports, because the full-list row needs it in the
// browser. Leaving it in lib/full-catalogue pulled that whole file — the Prisma
// where clause, the row builder, the label formatter and its allowlist — into
// the client bundle of every page that reaches New Order, to run eight lines.
//
// The vocabulary is closed: every attribute is written by `serviceAttributes`
// in lib/reseller-format, never by a provider, so this classifies a fixed set
// rather than free text. Order matters — "365-day refill" carries a number and
// a time unit, the same shape a rate limit has, so refill is tested first.
//
//   refill    the guarantee: Lifetime, N-day, Non-drop, or none
//   speed     when it starts and how fast it runs
//   quality   what the accounts are like
//   location  whose accounts they are
//   other     anything with no family; shown plainly rather than dropped

/**
 * Where a service's accounts come from. 1,771 of the full list's 6,524 say so —
 * 27% — and for a Nigerian panel that is the difference between an audience
 * that looks like yours and one that does not.
 *
 * Read off the label as well as the attributes, because only "Nigerian" and
 * "Worldwide" are attributes: serviceAttributes has no rule for USA, Indian or
 * Turkish, so those live in the name and nowhere else.
 *
 * Keys are ordered most-specific first. "American" is tested before "Asian"
 * would ever see it, and the bare "us" is admitted only as a whole word, which
 * in a product name is the country and not the pronoun.
 */
export const LOCATION_PATTERNS = {
  nigerian:  /\bnigeria/i,
  usa:       /\busa\b|\bunited states\b|\bamerican?\b|\bus\b/i,
  uk:        /\buk\b|\bunited kingdom\b|\bbritish\b|\bengland\b/i,
  worldwide: /\bworldwide\b|\bglobal\b/i,
  european:  /\beurope/i,
  indian:    /\bindians?\b/i,
  turkish:   /\bturkey\b|\bturkish\b/i,
  brazilian: /\bbrazil/i,
  arab:      /\barab|\buae\b|\bemirates/i,
  african:   /\bafrica/i,
  asian:     /\basians?\b/i,
  russian:   /\brussians?\b/i,
  german:    /\bgermany?\b|\bgerman\b/i,
  french:    /\bfrench\b|\bfrance\b/i,
};

export const LOCATION_KEYS = Object.keys(LOCATION_PATTERNS);

/** Does this label-plus-attributes text claim the given origin? */
export function matchesLocation(text, key) {
  const re = LOCATION_PATTERNS[key];
  return re ? re.test(String(text || '')) : false;
}

/**
 * The two attributes long enough to cost a phone a whole badge row, and the
 * trade terms they are known by. A full-list row on a 360px screen fits about
 * three chips; "Ultra high quality" alone is wider than two of them, so on a
 * narrow screen it pushes the refill and start-time badges onto a second line.
 *
 * Only these two. An abbreviation the reader has to decode is a cost, and it
 * is worth paying where the alternative is a badge row that wraps — not for
 * "Non-drop" or "Worldwide", which already fit.
 *
 * The full word is what the row shows from 768px up, and it is the only form
 * the reseller API ever sends: this is a display decision about a narrow
 * screen, not a change to what a service is called.
 */
export const ATTR_SHORT = {
  'Ultra high quality': 'UHQ',
  'High quality': 'HQ',
};

/**
 * The grades a provider states, best first, and the reason they are one list
 * rather than two: nobody filtering for quality wants the top grade excluded
 * because they picked the other word. The full list offers a single control
 * over both, and the row still shows which of the two a service actually
 * carries.
 */
export const QUALITY_ATTRS = ['Ultra high quality', 'High quality'];
export function isGraded(attrs) {
  return (attrs || []).some(a => QUALITY_ATTRS.includes(a));
}

export function attrKind(attr) {
  const a = String(attr || '').toLowerCase();
  if (/refill|guarantee|non-?drop/.test(a)) return 'refill';
  if (/\binstant\b|starts in|\/day|0-24 hours/.test(a)) return 'speed';
  // \bhq\b on its own would not see the hq inside uhq — h is preceded by a word
  // character there, so the boundary never opens.
  if (/\buhq\b|\bhq\b|high quality|premium account|\breal\b|royalt/.test(a)) return 'quality';
  if (/nigerian|worldwide|global|usa|american|indian|european|uae|arab|turkish|brazil|asian|african|russian|french|german|spanish|italian|korean|japanese|chinese/.test(a)) return 'location';
  return 'other';
}
