'use client';

/**
 * What a service delivers, as one glyph.
 *
 * Its own module because both lists draw it and they cannot import each other:
 * New Order renders the full list, so the full list reaching back for a glyph
 * would be a cycle. Keeping the shapes here also keeps the two views drawing
 * the same followers icon rather than two that drifted apart.
 *
 * A column of names has to be read; a column of glyphs can be scanned, which is
 * the whole reason this exists — on the full list it is nine hundred rows.
 */
export const TYPE_GLYPH = {
  followers: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></>,
  likes: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>,
  views: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  comments: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>,
  verified: <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/>,
  plays: <polygon points="5 3 19 12 5 21 5 3"/>,
  members: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
  shares: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
  saves: <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>,
  downloads: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  traffic: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>,
  engagement: <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
};

/**
 * The square the glyph sits in. `tone` is the ink; the square is mixed from it
 * so it always lands deeper than whatever it sits on — a Nigerian card is
 * already that exact green, and a square tinted the same way disappears.
 */
export function ServiceGlyph({ type, tone, dark, size = 34, radius = 10, className = "" }) {
  return (
    <span className={`shrink-0 flex items-center justify-center ${className}`}
      style={{
        width: size, height: size, borderRadius: radius,
        background: `color-mix(in srgb, ${tone} ${dark ? 30 : 20}%, ${dark ? "#171126" : "#fffdfb"})`,
        color: tone,
      }}>
      <svg width={Math.round(size * 0.47)} height={Math.round(size * 0.47)} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {TYPE_GLYPH[type] || TYPE_GLYPH.followers}
      </svg>
    </span>
  );
}
