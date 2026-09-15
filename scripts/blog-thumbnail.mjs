/**
 * Blog thumbnails, in the house style.
 *
 * The 24 thumbnails already in public/blog share a template nobody wrote down:
 * a 1200×640 card on #1a0f14, two brand-coloured circles bleeding off the top
 * right, a Nitro-pink wedge in the bottom-left corner, a translucent panel
 * holding a small illustration of whatever the post is about, the platform mark
 * in a rounded badge at 72,72, and the title in Georgia with its second line in
 * the brand colour. This encodes it so the next 26 match the first 24 instead
 * of drifting a little further each time somebody makes one by hand.
 *
 * SVG rather than PNG because these are flat vector shapes: a 2KB file that
 * stays sharp on any screen, versus 80KB that does not. The two .webp files in
 * there are photographs, which is a different job.
 *
 * Text is drawn with <text>, so the viewer's font list decides the shape.
 * Georgia is on every desktop and phone that matters and the fallback is a
 * generic serif, which is close enough — a thumbnail is not a typesetting job.
 */

const W = 1200, H = 640;
const BG = '#1a0f14';
const NITRO = '#c47d8e';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** rgba() from a #rrggbb and an alpha, because the template uses both forms. */
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * @param {object} o
 * @param {string[]} o.title      one or two lines; the second takes the brand colour
 * @param {string} o.colour       the platform's own colour, or Nitro pink
 * @param {string} o.bright       a lighter version for text, since brand colours
 *                                are usually too dark to read on #1a0f14
 * @param {string} o.glyph        SVG path drawn white inside the badge, on a 0 0 48 48 grid
 * @param {string} [o.card]       the inner illustration; helpers below build these
 */
export function thumbnail({ title, colour, bright, glyph, card = '' }) {
  const [line1, line2] = title;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="${BG}"/>
<circle cx="1000" cy="130" r="350" fill="${colour}" opacity="0.06"/>
<circle cx="1060" cy="210" r="210" fill="${colour}" opacity="0.04"/>
<polygon points="0,640 0,530 260,640" fill="${NITRO}" opacity="0.06"/>
<rect x="740" y="110" width="360" height="270" rx="24" fill="${rgba(colour, 0.03)}" stroke="${rgba(colour, 0.08)}" stroke-width="1.5"/>
${card}
<rect x="72" y="72" width="96" height="96" rx="24" fill="${colour}"/>
<g transform="translate(96,96) scale(2)" fill="#fff">${glyph}</g>
<text x="80" y="440" font-family="Georgia, serif" font-size="56" fill="white" font-weight="700" letter-spacing="-1">${esc(line1)}</text>
${line2 ? `<text x="80" y="516" font-family="Georgia, serif" font-size="56" fill="${bright}" font-weight="700" letter-spacing="-1">${esc(line2)}</text>` : ''}
<text x="80" y="590" font-family="system-ui" font-size="22" fill="rgba(255,255,255,0.3)" letter-spacing="6">NITRO BLOG</text>
</svg>
`;
}

// ── Card illustrations ──────────────────────────────────
// Each is a small diagram of the thing the post is about, drawn inside the
// panel at 740,110. They exist so 26 thumbnails do not share one picture.

/** A rising bar chart — plays, streams, views, anything that grows. */
export function cardBars(c, values = [0.35, 0.5, 0.42, 0.7, 0.88], label = '') {
  const x0 = 790, base = 340, w = 42, gap = 22, maxH = 170;
  const bars = values.map((v, i) => {
    const h = Math.round(maxH * v);
    return `<rect x="${x0 + i * (w + gap)}" y="${base - h}" width="${w}" height="${h}" rx="7" fill="${rgba(c, 0.1 + 0.16 * v)}"/>`;
  }).join('\n');
  return `${bars}\n<line x1="782" y1="348" x2="1060" y2="348" stroke="${rgba(c, 0.14)}" stroke-width="2"/>${
    label ? `\n<text x="782" y="372" font-family="system-ui" font-size="13" fill="${rgba(c, 0.34)}">${esc(label)}</text>` : ''}`;
}

/** Stacked rows — a follower list, a member list, a set of reviews. */
export function cardRows(c, rows = ['', '', ''], { pill = null } = {}) {
  const out = rows.map((label, i) => {
    const y = 155 + i * 58;
    return `<rect x="780" y="${y}" width="280" height="44" rx="10" fill="${rgba(c, 0.07)}"/>
<circle cx="806" cy="${y + 22}" r="13" fill="${rgba(c, 0.2)}"/>
${label ? `<text x="832" y="${y + 27}" font-family="system-ui" font-size="14" fill="${rgba(c, 0.45)}">${esc(label)}</text>` : `<rect x="832" y="${y + 15}" width="${120 + i * 30}" height="8" rx="4" fill="${rgba(c, 0.12)}"/>`}`;
  }).join('\n');
  return out + (pill ? `\n<rect x="780" y="330" width="${16 + pill.length * 9}" height="34" rx="8" fill="${rgba(c, 0.15)}"/>
<text x="${788 + (16 + pill.length * 9) / 2 - 8}" y="353" font-family="system-ui" font-size="14" fill="${c}" text-anchor="middle" font-weight="600">${esc(pill)}</text>` : '');
}

/** Five stars with a rating — reviews, reputation. */
export function cardStars(c, filled = 4.5, caption = '') {
  const star = (cx, cy, r, fill) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.42 : r;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
  };
  const stars = Array.from({ length: 5 }, (_, i) =>
    star(806 + i * 58, 200, 24, rgba(c, i < Math.floor(filled) ? 0.55 : 0.12))).join('\n');
  // One font-family, not two — a repeated attribute is a parse error, and an
  // SVG that fails to parse renders as a broken-image icon with no warning.
  return `${stars}
<text x="782" y="272" font-family="Georgia, serif" font-size="34" fill="${rgba(c, 0.6)}" font-weight="700">${filled.toFixed(1)}</text>
${caption ? `<text x="782" y="304" font-family="system-ui" font-size="13" fill="${rgba(c, 0.3)}">${esc(caption)}</text>` : ''}`;
}

/** A progress bar toward a number — thresholds, targets, monetisation. */
export function cardProgress(c, { headline, pct = 0.7, under = '' }) {
  return `<rect x="780" y="155" width="280" height="44" rx="10" fill="${rgba(c, 0.08)}"/>
<text x="920" y="183" font-family="system-ui" font-size="16" fill="${rgba(c, 0.5)}" text-anchor="middle" font-weight="600">${esc(headline)}</text>
<rect x="780" y="215" width="280" height="6" rx="3" fill="rgba(255,255,255,0.05)"/>
<rect x="780" y="215" width="${Math.round(280 * pct)}" height="6" rx="3" fill="${rgba(c, 0.25)}"/>
${under ? `<text x="780" y="245" font-family="system-ui" font-size="13" fill="${rgba(c, 0.3)}">${esc(under)}</text>` : ''}
<rect x="780" y="270" width="130" height="36" rx="8" fill="${rgba(c, 0.15)}"/>
<text x="845" y="294" font-family="system-ui" font-size="14" fill="${c}" text-anchor="middle" font-weight="600">Nitro</text>`;
}

/** A grid of tiles — a catalogue, many platforms, breadth. */
export function cardGrid(c, cols = 5, rows = 4) {
  const out = [];
  const w = 48, h = 42, gx = 12, gy = 12;
  const x0 = 790, y0 = 150;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const o = 0.05 + ((n * 7) % 13) / 100;
      out.push(`<rect x="${x0 + col * (w + gx)}" y="${y0 + r * (h + gy)}" width="${w}" height="${h}" rx="9" fill="${rgba(c, o)}"/>`);
      n++;
    }
  }
  return out.join('\n');
}

/** Two currency chips trading places — FX, multi-currency, cross-border. */
export function cardSwap(c, left = '₦', right = '$') {
  return `<circle cx="850" cy="220" r="62" fill="${rgba(c, 0.1)}" stroke="${rgba(c, 0.2)}" stroke-width="1.5"/>
<text x="850" y="242" font-family="Georgia, serif" font-size="52" fill="${rgba(c, 0.6)}" text-anchor="middle" font-weight="700">${esc(left)}</text>
<circle cx="990" cy="220" r="62" fill="${rgba(c, 0.06)}" stroke="${rgba(c, 0.12)}" stroke-width="1.5"/>
<text x="990" y="242" font-family="Georgia, serif" font-size="52" fill="${rgba(c, 0.3)}" text-anchor="middle" font-weight="700">${esc(right)}</text>
<path d="M898,200 L942,200 M930,190 L942,200 L930,210" stroke="${rgba(c, 0.35)}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M942,246 L898,246 M910,236 L898,246 L910,256" stroke="${rgba(c, 0.18)}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="920" y="340" font-family="system-ui" font-size="13" fill="${rgba(c, 0.3)}" text-anchor="middle">no dollar card needed</text>`;
}

/** A waveform — music, audio, streaming. */
export function cardWave(c, bars = 26) {
  const out = [];
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1);
    const v = Math.abs(Math.sin(t * Math.PI * 2.2)) * 0.75 + 0.18 + ((i * 13) % 7) / 40;
    const h = Math.round(150 * Math.min(v, 1));
    out.push(`<rect x="${788 + i * 11.5}" y="${245 - h / 2}" width="6" height="${h}" rx="3" fill="${rgba(c, 0.12 + 0.3 * v)}"/>`);
  }
  return out.join('\n') + `\n<text x="782" y="352" font-family="system-ui" font-size="13" fill="${rgba(c, 0.3)}">streams · saves · listeners</text>`;
}
