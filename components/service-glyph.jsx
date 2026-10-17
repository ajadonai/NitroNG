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
// Each glyph is offset print (17 Oct 2026): o is the shape printed under the
// outline, l the outline. Fixed strings written here, which is what makes
// injecting them as markup safe.
export const TYPE_GLYPH = {
  followers: { o: '<path d="M3 20.5c0-3.4 2.6-6 6-6s6 2.6 6 6z"/>', l: '<circle cx="9" cy="8" r="3.6"/><path d="M3 20.5c0-3.4 2.6-6 6-6s6 2.6 6 6M15.5 4.8a3.6 3.6 0 0 1 0 6.4M17 14.7c2.4.5 4 2.6 4 5.8"/>' },
  likes: { o: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>', l: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>' },
  views: { o: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/>', l: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>' },
  comments: { o: '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/>', l: '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM7.5 9.5h9M7.5 13h6"/>' },
  verified: { o: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>', l: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>' },
  plays: { o: '<path d="M7 4.5v15l12-7.5z"/>', l: '<path d="M7 4.5v15l12-7.5z"/>' },
  members: { o: '<path d="M3 20.5c0-3.4 2.6-6 6-6s6 2.6 6 6z"/>', l: '<circle cx="9" cy="8" r="3.6"/><path d="M3 20.5c0-3.4 2.6-6 6-6s6 2.6 6 6M15.5 4.8a3.6 3.6 0 0 1 0 6.4M17 14.7c2.4.5 4 2.6 4 5.8"/>' },
  shares: { o: '<circle cx="17.5" cy="5.5" r="2.8"/><circle cx="6.5" cy="12" r="2.8"/><circle cx="17.5" cy="18.5" r="2.8"/>', l: '<circle cx="17.5" cy="5.5" r="2.8"/><circle cx="6.5" cy="12" r="2.8"/><circle cx="17.5" cy="18.5" r="2.8"/><path d="M9 13.4l6 3.7M15 6.9 9 10.6"/>' },
  saves: { o: '<path d="M6.5 3.5h11V21L12 16.8 6.5 21z"/>', l: '<path d="M6.5 3.5h11V21L12 16.8 6.5 21z"/>' },
  downloads: { o: '<path d="M3.5 14h17v4a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18z"/>', l: '<path d="M3.5 14v4A2.5 2.5 0 0 0 6 20.5h12a2.5 2.5 0 0 0 2.5-2.5v-4M12 3.5v10M7.5 9.5l4.5 4.5 4.5-4.5"/>' },
  traffic: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/>' },
  engagement: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<path d="M20.5 11.2V12a8.5 8.5 0 1 1-5-7.8M20.5 4.8 12 13.3l-2.6-2.6"/>' },
};

const glyphMarkup = ({ o, l }) =>
  `<g class="ic-off" transform="translate(1.4 1.4)">${o}</g><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${l}</g>`;

/**
 * The square the glyph sits in. `tone` is the ink; the square is mixed from it
 * so it always lands deeper than whatever it sits on — a Nigerian card is
 * already that exact green, and a square tinted the same way disappears.
 */
// The two audiences with a chip of their own, drawn rather than emoji so they
// render the same on every phone. Both lists import them from here: the full
// list is imported by New Order, so it cannot import back.
export const AUDIENCE_FLAG = {
  ng: <svg width="14" height="10" viewBox="0 0 3 2" aria-hidden="true"><rect width="1" height="2" fill="#0f8a4e" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#0f8a4e" /></svg>,
  us: <svg width="14" height="10" viewBox="0 0 19 10" aria-hidden="true"><rect width="19" height="10" fill="#fff" />{[0, 2, 4, 6, 8, 10, 12].map(i => <rect key={i} y={i * 10 / 13} width="19" height={10 / 13} fill="#c8102e" />)}<rect width="7.6" height={10 / 13 * 7} fill="#1f3f8a" /></svg>,
};

// `print` adds the hard offset the sidebars and the tour print their tiles with.
export function ServiceGlyph({ type, tone, dark, size = 34, radius = 10, className = "", print = false }) {
  return (
    <span className={`shrink-0 flex items-center justify-center ${className}`}
      style={{
        width: size, height: size, borderRadius: radius,
        background: `color-mix(in srgb, ${tone} ${dark ? 30 : 20}%, ${dark ? "#171126" : "#fffdfb"})`,
        color: tone,
        ...(print ? { boxShadow: `2px 2px 0 ${dark ? "#6b3a4a" : "#efc4cf"}` } : null),
      }}>
      <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" aria-hidden="true" style={{ overflow: "visible" }}
        dangerouslySetInnerHTML={{ __html: glyphMarkup(TYPE_GLYPH[type] || TYPE_GLYPH.followers) }} />
    </span>
  );
}
