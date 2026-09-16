/**
 * The five language flags, drawn rather than typed.
 *
 * lib/i18n.js carries an emoji flag per locale and those are fine in prose.
 * They are not fine as a UI element, for two reasons found while fitting them
 * into the nav roundel:
 *
 *   1. Chrome and Edge on Windows do not render country flag emoji at all.
 *      They fall back to the regional-indicator letters, so "🇬🇧" arrives as a
 *      boxy "GB". Firefox on Windows bundles Twemoji and does show them, and
 *      every phone shows them, which is exactly why this is easy to miss from
 *      a Mac. Our desktop share skews to the diaspora audience these languages
 *      are for, so it is the wrong group to show a broken glyph to.
 *
 *   2. An emoji flag is a 3:2 rectangle with the glyph's own leading around
 *      it. Cropping one into a circle leaves the container showing through top
 *      and bottom no matter how far it is scaled, because scaling covers the
 *      long axis first. Every value tried left a visible sliver.
 *
 * Drawn as square artwork clipped to the circle, both problems go away: the
 * fill is exact by construction and identical on every platform. At 24px the
 * simplification costs nothing — Kenya's shield is two ellipses and a bar, and
 * nobody will ever know.
 */

const FLAGS = {
  // Vertical thirds, green–white–green.
  ng: '<rect width="8" height="24" fill="#008751"/><rect x="8" width="8" height="24" fill="#fff"/><rect x="16" width="8" height="24" fill="#008751"/>',

  // Tricolore.
  fr: '<rect width="8" height="24" fill="#002395"/><rect x="8" width="8" height="24" fill="#fff"/><rect x="16" width="8" height="24" fill="#ED2939"/>',

  // Horizontal bands, red–white–black.
  eg: '<rect width="24" height="8" fill="#CE1126"/><rect y="8" width="24" height="8" fill="#fff"/><rect y="16" width="24" height="8" fill="#141414"/>',

  // Black, red and green with white fimbriations, and the shield at the centre.
  ke: '<rect width="24" height="24" fill="#fff"/>'
    + '<rect width="24" height="7" fill="#141414"/><rect y="8" width="24" height="8" fill="#BB0000"/><rect y="17" width="24" height="7" fill="#006600"/>'
    + '<ellipse cx="12" cy="12" rx="3.4" ry="7" fill="#fff"/><ellipse cx="12" cy="12" rx="2.4" ry="5.6" fill="#BB0000"/>'
    + '<rect x="11.4" y="4" width="1.2" height="16" fill="#fff" opacity=".85"/>',

  // The Union flag: navy ground, white saltire, red saltire, white cross, red
  // cross. Drawn square, so the diagonals are steeper than the real 3:2 flag —
  // correct at this size, and the alternative is letterboxing inside a circle.
  gb: '<rect width="24" height="24" fill="#012169"/>'
    + '<path d="M0,0 L24,24 M24,0 L0,24" stroke="#fff" stroke-width="5"/>'
    + '<path d="M0,0 L24,24 M24,0 L0,24" stroke="#C8102E" stroke-width="2.6"/>'
    + '<path d="M12,0 V24 M0,12 H24" stroke="#fff" stroke-width="8"/>'
    + '<path d="M12,0 V24 M0,12 H24" stroke="#C8102E" stroke-width="4.4"/>',
};

/** Which flag each locale shows. Kept here, not in i18n, because it is artwork. */
export const LOCALE_FLAG = { en: 'gb', pcm: 'ng', fr: 'fr', sw: 'ke', ar: 'eg' };

/**
 * An `<svg>` string for one flag, already round.
 * @param {string} key  a key of FLAGS, or a locale code
 * @param {number} size px
 */
/**
 * Square artwork. The circle is the container's job, not this file's.
 *
 * This used to carry its own `<clipPath id="fc-gb">`, which is wrong twice
 * over: the id is identical on every call, so the trigger and all five menu
 * rows put the same id in one document — and the moment that clip does not
 * resolve, the flag renders as a full square inside a round button with
 * nothing to stop it. There is no id here now and nothing to collide.
 * `.loc-flag` clips with overflow:hidden and a 50% radius, which cannot fail.
 */
export function flagSvg(key, size = 24) {
  const art = FLAGS[key] || FLAGS[LOCALE_FLAG[key]];
  if (!art) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"`
    + ` preserveAspectRatio="xMidYMid slice">${art}</svg>`;
}

export const FLAG_KEYS = Object.keys(FLAGS);
export default FLAGS;
