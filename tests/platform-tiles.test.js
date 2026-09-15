import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = fs.readFileSync(path.join(process.cwd(), 'components/new-order.jsx'), 'utf8');

/**
 * The platform picker draws a rail of each platform's own colour, because
 * thirty-six identical grey chips meant nobody recognised a logo — they read
 * thirty-six labels instead.
 *
 * A tile with no colour falls back to the Nitro accent, which is right for
 * Nitro's own product and wrong for anything else: a new platform would be
 * added and quietly look like it belonged to us.
 */
describe('every platform tile has its own colour', () => {
  const ids = [...src.matchAll(/id: "([a-z]+)"/g)].map(m => m[1]);
  const brandBlock = src.slice(src.indexOf('const BRAND = {'), src.indexOf('const brandOf'));

  it('covers every platform in the picker', () => {
    // Web Traffic is Nitro's, so it takes the accent on purpose. Everything
    // else is somebody's brand and must carry it.
    const NITRO_OWN = ['webtraffic'];
    const missing = ids.filter(id => !NITRO_OWN.includes(id) && !new RegExp(`(^|[{,\\s])${id}:`).test(brandBlock));
    expect(missing, `these tiles would silently take the Nitro accent: ${missing.join(', ')}`).toEqual([]);
    expect(ids.length).toBeGreaterThan(30);
  });

  it('lifts every black mark off the dark canvas', () => {
    // #000000 on #171126 is not a rail, it is a gap.
    const onDark = src.slice(src.indexOf('const ON_DARK = {'), src.indexOf('const INK_ON_LIGHT'));
    for (const id of ['tiktok', 'twitter', 'threads', 'tidal', 'playstore']) {
      expect(new RegExp(`${id}: "`).test(onDark), `${id} is black and needs a value for the dark ground`).toBe(true);
    }
  });

  it('darkens only the text of a brand too light to read, never the brand', () => {
    // Snapchat is #FFFC00 and stays #FFFC00 — that is what Snapchat is. The
    // rail and the glyph show it; only the label takes a darker value, because
    // #FFFC00 on white is about 1.1:1 and a rail does not have to be read.
    const inkBlock = src.slice(src.indexOf('const INK_ON_LIGHT = {'), src.indexOf('/** The colour to paint'));
    for (const id of ['snapchat', 'kick', 'clubhouse']) {
      expect(new RegExp(`${id}: "`).test(inkBlock), `${id} cannot carry text on the light ground`).toBe(true);
    }
    expect(brandBlock).toMatch(/snapchat: "#FFFC00"/);
    expect(brandBlock).toMatch(/kick: "#53FC19"/);
  });

  it('takes its values from simple-icons, not from memory', () => {
    // Hand-written brand colours went stale: Instagram carried the retired
    // #E1306C and Facebook the pre-2023 #1877F2.
    expect(src).toMatch(/simple-icons/);
    expect(brandBlock).toMatch(/instagram: "#FF0069"/);
    expect(brandBlock).toMatch(/facebook: "#0866FF"/);
    expect(brandBlock).not.toMatch(/#E1306C|#1877F2/);
    // The four with no entry are named as such rather than left looking sourced.
    for (const id of ['linkedin', 'boomplay', 'tidal']) {
      expect(brandBlock).toMatch(new RegExp(`${id}: "#[0-9A-F]{6}",\\s*// not in simple-icons`, 'i'));
    }
  });

  it('draws the tile in one place, not three', () => {
    // The desktop grid, the phone window and the expanded sheet used to carry
    // the same markup three times and differ only in height and radius.
    expect(src).toMatch(/function PlatformTile\(/);
    expect([...src.matchAll(/<PlatformTile /g)]).toHaveLength(3);
    expect([...src.matchAll(/no-plat-tile/g)], 'the tile class should appear once, inside the component').toHaveLength(1);
  });

  it('carries no service count', () => {
    // It showed the curated number, which is right on Nitro picks and wrong the
    // moment the selector switches to the full list: Instagram is 19 on one
    // view and 934 on the other. A badge that does not move when the list
    // behind it does is worse than no badge.
    // Scoped to the function itself. Slicing to NewOrderPage swept in every
    // helper between them, and the guard tripped on the word "count" inside an
    // unrelated comment.
    const from = src.indexOf('function PlatformTile(');
    const tile = src.slice(from, src.indexOf('\n}', from) + 2);
    expect(tile).not.toMatch(/platformCounts/);
    expect(tile).not.toMatch(/\bcount\b/);
  });

  it('thins the rail where the tile is narrow', () => {
    // At five columns a 3px rail stops reading as an accent and becomes a
    // stripe across the corner.
    expect(src).toMatch(/const rail = compact \? 2 : 3;/);
  });
});

/**
 * The service card carries a glyph for what the service delivers, because a
 * column of names has to be read where a column of icons can be scanned.
 *
 * It is keyed off ServiceGroup.type, a field the menu already carries and which
 * still holds provider-era spellings — "Channel Members" and "channel-members"
 * are the same thing written twice. An unmapped type falls back to the
 * followers glyph, which is safe but silently wrong, so every type live in the
 * catalogue is pinned here.
 */
describe('every service type has its own glyph', () => {
  const keyBlock = src.slice(src.indexOf('const TYPE_KEY = {'), src.indexOf('const glyphKey'));
  // The shapes live in components/service-glyph so both lists draw the same ones.
  const glyphSrc = fs.readFileSync(path.join(process.cwd(), 'components/service-glyph.jsx'), 'utf8');
  const glyphBlock = glyphSrc.slice(glyphSrc.indexOf('export const TYPE_GLYPH = {'), glyphSrc.indexOf('export function ServiceGlyph'));

  // Every distinct ServiceGroup.type with an enabled group, 15 Sep 2026.
  const LIVE = ['followers', 'likes', 'views', 'engagement', 'plays', 'comments', 'reviews',
    'Standard', 'default', 'downloads', 'shorts-comments', 'verified-comments', 'podcast-followers',
    'reposts', 'community-members', 'saves', 'listeners', 'channel-members', 'Channel Members',
    'monthly-listeners', 'reshares', 'shorts-views', 'traffic'];

  it('maps every type the catalogue actually uses', () => {
    const missing = LIVE.filter(t => !new RegExp(`(^|[{,\\s])("${t}"|${t}):`).test(keyBlock));
    expect(missing, `these would silently show the followers glyph: ${missing.join(', ')}`).toEqual([]);
  });

  it('points every mapping at a glyph that exists', () => {
    const targets = [...new Set([...keyBlock.matchAll(/: "([a-z]+)"/g)].map(m => m[1]))];
    const orphans = targets.filter(g => !new RegExp(`(^|[{,\\s])${g}:`).test(glyphBlock));
    expect(orphans, `mapped to a glyph that is not defined: ${orphans.join(', ')}`).toEqual([]);
    expect(targets.length).toBeGreaterThan(8);
  });

  it('takes the colour the card already carries, mixed deeper than the card', () => {
    // Nigerian green, US red, package blue, or the accent — not a new palette.
    // But mixed from the ink, never the card's own tint: a Nigerian card is
    // already exactly accent.bgL, so a square painted the same way vanished on
    // three rows in five.
    const card = src.slice(src.indexOf('function ServiceCard('), src.indexOf('function compactPrice'));
    expect(card).toMatch(/<ServiceGlyph type=\{glyphKey\(svc\.type\)\} tone=\{ink\}/);
    expect(glyphSrc).toMatch(/color-mix\(in srgb, \$\{tone\}/);
    expect(glyphSrc, 'the square must be mixed from the ink, never handed a card background')
      .not.toMatch(/accent\.bgL|accent\.bgD/);
  });

  it('draws the same glyph on both lists, from one module', () => {
    // New Order renders the full list, so the full list cannot import back for
    // a glyph. Shared shapes also stop the two views drifting to two different
    // followers icons.
    const full = fs.readFileSync(path.join(process.cwd(), 'components/full-list.jsx'), 'utf8');
    expect(full).toMatch(/import \{ ServiceGlyph \} from "\.\/service-glyph"/);
    expect(src).toMatch(/import \{ ServiceGlyph \} from "\.\/service-glyph"/);
    expect(glyphSrc).not.toMatch(/from "\.\/(new-order|full-list)"/);
    // Every type the full list produces must have a shape.
    for (const t of ['followers', 'members', 'likes', 'views', 'comments', 'shares', 'engagement']) {
      expect(new RegExp(`(^|[{,\\s])${t}:`).test(glyphBlock), `${t} has no glyph`).toBe(true);
    }
  });
});

/**
 * The brand colours are real, which means some of them cannot be read.
 * Snapchat is #FFFC00 and that is correct; it is also 1.1:1 on white. So the
 * rail and the glyph show the true colour and only the *label* takes a
 * darkened one, and this measures the result rather than trusting an eye —
 * eight of these were missed by looking at them.
 */
describe('every platform label is readable on both grounds', () => {
  const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
  const parse = (t) => Object.fromEntries([...t.matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)].map(m => [m[1], m[2]]));
  const BRAND = parse(grab('const BRAND = {', '/**\n * Two substitutions'));
  const ON_DARK = parse(grab('const ON_DARK = {', 'const INK_ON_LIGHT'));
  const INK_ON_LIGHT = parse(grab('const INK_ON_LIGHT = {', '/** The colour to paint'));

  const lum = (h) => {
    const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const LIGHT_CARD = '#fffdfb';
  const DARK_CARD = '#171126';

  it('clears 3:1 for every brand, light and dark', () => {
    const failures = [];
    for (const [id, hex] of Object.entries(BRAND)) {
      const onLight = INK_ON_LIGHT[id] || hex;
      const onDark = ON_DARK[id] || hex;
      const rl = contrast(onLight, LIGHT_CARD);
      const rd = contrast(onDark, DARK_CARD);
      if (rl < 3) failures.push(`${id} on light: ${onLight} is ${rl.toFixed(2)}:1`);
      if (rd < 3) failures.push(`${id} on dark: ${onDark} is ${rd.toFixed(2)}:1`);
    }
    expect(failures, `unreadable labels:\n  ${failures.join('\n  ')}`).toEqual([]);
    expect(Object.keys(BRAND).length).toBeGreaterThan(30);
  });

  it('never substitutes a colour that is already readable', () => {
    // A substitution is a small lie about the brand, so it is only worth making
    // where the true colour genuinely fails. If one becomes unnecessary it
    // should go, not linger.
    const pointless = [];
    for (const [id, ink] of Object.entries(INK_ON_LIGHT)) {
      if (contrast(BRAND[id], LIGHT_CARD) >= 3) pointless.push(`${id} reads fine on light as ${BRAND[id]}`);
    }
    for (const [id, ink] of Object.entries(ON_DARK)) {
      if (contrast(BRAND[id], DARK_CARD) >= 3) pointless.push(`${id} reads fine on dark as ${BRAND[id]}`);
    }
    expect(pointless, `these substitutions are not needed:\n  ${pointless.join('\n  ')}`).toEqual([]);
  });
});

/**
 * The list selector. A segmented control splits the width in half, and that is
 * a claim about the two lists: it says they are the same size. They are 19 and
 * 934 on Instagram, 4 and 840 on TikTok — between 1:49 and 1:242. So the count
 * leads and does the arguing, which no subtitle managed.
 */
describe('the picks / full list selector', () => {
  const sel = src.slice(src.indexOf('═══ VERSION SELECTOR ═══'), src.indexOf('═══ GROUP TABS ═══'));

  it('sits two across on a phone rather than stacking', () => {
    // Stacked, with their subtitles, the two cards cost 128px of a 640px screen
    // before the platform tiles begin. Two across is 48px.
    expect(sel).toMatch(/grid grid-cols-2 gap-2/);
    expect(sel).not.toMatch(/grid-cols-1 md:grid-cols-2/);
  });

  it('drops the subtitle on a phone, which is what pays for the height', () => {
    // It is read once and is furniture after that. Everything doing work —
    // glyph, count, rail, the blue — survives at both sizes.
    expect(sel).toMatch(/hidden md:block text-\[10\.5px\]/);
    expect(sel).toMatch(/w-\[28px\] h-\[28px\] md:w-\[34px\] md:h-\[34px\]/);
  });

  it('names the list, and puts the count at the edge where the two align', () => {
    // The name says what the list is; the number says how big it is. Leading
    // with the number read as "934 more", which never said what it was more of.
    expect(sel).toMatch(/msg\("Nitro picks"\)/);
    expect(sel).toMatch(/msg\("Full list"\)/);
    expect(sel).toMatch(/tabular-nums/);
    // In a pill, like every other count on New Order — the section markers and
    // the platform sheet both badge theirs, and a bare number here was the one
    // exception. Tinted from the card's colour so it pairs with the glyph
    // square opposite it rather than floating.
    expect(sel).toMatch(/tabular-nums rounded-full/);
    expect(sel).toMatch(/background: on \? v\.tintBg/);
    // And says so rather than showing a zero while the count is still loading.
    expect(sel).toMatch(/v\.n == null \? "—"/);
  });

  it('tells the two apart by colour, not only position', () => {
    // The full list takes the blue it already uses on its own view.
    expect(sel).toMatch(/#7aa2f7/);
    expect(sel).toMatch(/#1d5fa5/);
  });

  it('is not offered in bulk, which has no full list to switch to', () => {
    expect(sel).toMatch(/orderMode === "single" &&/);
  });
});
