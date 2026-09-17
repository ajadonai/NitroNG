import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The shared controls, and the measurements behind them.
 *
 * Every number in this file was arrived at by measuring, not by taste, so each
 * has a test saying what it costs to change it back. The contrast ones are the
 * point: the filled primary shipped for months at 2.05:1 in dark mode, which is
 * white text nobody could read, and five of six action colours failed on their
 * own tints.
 */
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => {
  const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg, alpha, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
const dist = (a, b) => Math.round(Math.sqrt(hex(a).reduce((s, v, i) => s + (v - hex(b)[i]) ** 2, 0)));
const CARD_LIGHT = hex('#fffdfb');
const CARD_DARK = hex('#171126');

describe('the filled primary is readable', () => {
  it('carries white ink in light mode', () => {
    // #c47d8e — the old fill — is 3.15:1 and fails. #96626f is the lightest
    // rose that passes, which is why the gradient had to get deeper.
    expect(ratio(hex('#96626f'), hex('#ffffff'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex('#7a4f5c'), hex('#ffffff'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex('#c47d8e'), hex('#ffffff')), 'the old fill, for the record').toBeLessThan(4.5);
  });

  it('inverts in dark mode rather than keeping white ink', () => {
    // White on the dark accent is 2.05:1. A lit face with dark ink is 8.8:1.
    expect(ratio(hex('#e9b0bf'), hex('#241019'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex('#d492a6'), hex('#241019'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex('#e3a4b5'), hex('#ffffff')), 'why it inverts').toBeLessThan(2.5);
  });

  it('states both fills in the stylesheet', () => {
    expect(css).toMatch(/--ctl-fill: linear-gradient\(165deg, #96626f 0%, #7a4f5c 100%\)/);
    expect(css).toMatch(/--ctl-on-fill: #241019/);
  });
});

describe('every row action passes on its own tint', () => {
  const light = { amber: '#a55a05', indigo: '#4f46e5', red: '#d12424', green: '#047c57', purple: '#9333ea' };
  const dark = { amber: '#fcd34d', indigo: '#a5b4fc', red: '#fca5a5', green: '#6ee7b7', purple: '#c77dff' };

  it('is legible in light mode at 8% tint', () => {
    for (const [name, c] of Object.entries(light)) {
      expect(ratio(hex(c), over(hex(c), 0.08, CARD_LIGHT)), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is legible in dark mode at 12% tint', () => {
    for (const [name, c] of Object.entries(dark)) {
      expect(ratio(hex(c), over(hex(c), 0.12, CARD_DARK)), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the old colours out, since they failed', () => {
    // #d97706 was 2.92, #c47d8e 2.90, #059669 3.42.
    for (const old of ['#d97706', '#059669', '#128c4a']) {
      expect(css, old).not.toContain(`--act-amber:  ${old}`);
    }
    expect(ratio(hex('#d97706'), over(hex('#d97706'), 0.08, CARD_LIGHT))).toBeLessThan(4.5);
  });

  it('uses one tint per colour, not five', () => {
    // The same amber was written at .06, .08, .10, .12 and .15 across eighteen
    // hand-typed copies, because each was typed by hand.
    const tints = [...css.matchAll(/--act-\w+-t:\s*rgba\([\d, ]+,\s*\.(\d+)\)/g)].map(m => m[1]);
    expect(new Set(tints.slice(0, 5)).size, 'light mode').toBe(1);
  });
});

describe('the action colours are told apart', () => {
  it('keeps Refill clear of every other action', () => {
    // It was the accent rose — the same colour as the primary button — so in a
    // row of six it read as "the main one". Under ~60 reads as the same hue.
    for (const c of ['#a55a05', '#4f46e5', '#d12424', '#047c57', '#25d366']) {
      expect(dist('#9333ea', c), c).toBeGreaterThan(60);
    }
  });

  it('keeps WhatsApp clear of Refund, which is the collision that started this', () => {
    expect(dist('#107e43', '#047c57'), 'the old pairing').toBeLessThan(60);
    expect(dist('#25d366', '#047c57'), 'brand green'). toBeGreaterThan(60);
  });
});

describe('WhatsApp is a brand mark, not a theme colour', () => {
  it('is the real green with dark ink', () => {
    expect(ratio(hex('#25d366'), hex('#0b2016'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(hex('#25d366'), hex('#ffffff')), 'what most of the web ships').toBeLessThan(2.5);
    expect(css).toMatch(/--wa: #25d366/);
    expect(css).toMatch(/--wa-ink: #0b2016/);
  });

  it('does not invert in dark mode the way the other controls do', () => {
    const darkBlock = css.slice(css.indexOf('.dark .wa-btn'), css.indexOf('.dark .wa-btn') + 200);
    expect(darkBlock, 'only the shadow and tint change').not.toMatch(/--wa:|--wa-ink:/);
  });
});

describe('the rules that hold it together', () => {
  it('sizes by height, never padding', () => {
    // A row of controls lines up regardless of what the labels say — the one
    // thing thirteen private classes could never manage between them.
    for (const [cls, h] of [['.nb.lg', 44], ['.nb', 34], ['.nb.sm', 28], ['.act', 28]]) {
      const rule = css.slice(css.indexOf(`\n${cls} {`), css.indexOf(`\n${cls} {`) + 400);
      expect(rule, cls).toMatch(new RegExp(`height: ${h}px`));
    }
  });

  it('gives every control a press state', () => {
    // Without one the whole admin is inert to the touch on a phone.
    for (const sel of ['.nb.pri:active', '.nb.sec:active', '.act:active', '.wa-btn:active']) {
      expect(css, sel).toContain(sel);
    }
  });

  it('sits a disabled button flat', () => {
    expect(css).toMatch(/\.nb:disabled[^}]*transform: none !important/);
  });

  it('keeps destructive ringed rather than filled', () => {
    const bad = css.slice(css.indexOf('.nb.bad {'), css.indexOf('.nb.bad {') + 220);
    expect(bad).toMatch(/background: var\(--t-card-bg\)/);
    expect(bad).not.toMatch(/background: var\(--t-red\)/);
  });
});

/**
 * The ratchet. Thirteen private button classes took about a year to accumulate,
 * one reasonable local decision at a time, and every one of them was defensible
 * on the day it was written. This is what stops the fourteenth.
 */
describe('nobody writes their own button again', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'components'))
    .filter(f => f.endsWith('.jsx'))
    .map(f => [f, fs.readFileSync(path.join(process.cwd(), 'components', f), 'utf8')]);

  it('has no page-private button class left', () => {
    // A two-or-three letter page prefix plus -b or -pri: bl-b, co-pri, us-b.
    // Matched on the CSS definition, since that is where one is born.
    const found = [];
    for (const [name, src] of files) {
      for (const m of src.matchAll(/\.([a-z]{2,4}-(?:b|pri|btn))(?:\.[a-z-]+)*(?::[a-z-]+)?\s*\{/g)) {
        if (['nb', 'act', 'wa-btn'].includes(m[1])) continue;
        if (/^(adm|nitro)-/.test(m[1])) continue;   // the shared ones
        found.push(`${name}: .${m[1]}`);
      }
    }
    expect(found, `private button classes:\n${found.join('\n')}`).toEqual([]);
  });

  it('uses the shared class in every admin header', () => {
    const headers = files.filter(([, s]) => s.includes('adm-header-row'));
    expect(headers.length).toBeGreaterThan(4);
    for (const [name, src] of headers) {
      const i = src.indexOf('adm-header-row');
      const seg = src.slice(i, i + 1200);
      for (const m of seg.matchAll(/<button[^>]*className=\{?["'`]([a-z][a-z0-9-]*)/g)) {
        expect(['nb', 'wa-btn', 'act'], `${name} header uses .${m[1]}`).toContain(m[1]);
      }
    }
  });

  it('never puts white ink on WhatsApp green again', () => {
    // .ou-b.wa was #fff on #25d366 — 1.98:1.
    for (const [name, src] of files) {
      const bad = /#25d366[^}]{0,60}color:\s*#fff|color:\s*#fff[^}]{0,60}#25d366/i.test(src);
      expect(bad, `${name} puts white on WhatsApp green`).toBe(false);
    }
  });
});

describe('one segmented control', () => {
  const files = fs.readdirSync(path.join(process.cwd(), 'components'))
    .filter(f => f.endsWith('.jsx'))
    .map(f => [f, fs.readFileSync(path.join(process.cwd(), 'components', f), 'utf8')]);

  it('leaves no page-private copy', () => {
    // Six pages had written their own at 9px, 10px and 11px — three radii for
    // one control, and none of them the pill that promotions already had right.
    const found = [];
    for (const [name, src] of files) {
      for (const m of src.matchAll(/\.([a-z]{2,4}-segs?)\b[^{]*\{/g)) found.push(`${name}: .${m[1]}`);
    }
    expect(found, found.join('\n')).toEqual([]);
  });

  it('rings the track and not the segments', () => {
    // A segment is a label inside a control, not a button, so it must not carry
    // the cue that means pressable.
    const track = css.slice(css.indexOf('\n.segs {'), css.indexOf('\n.segs {') + 260);
    expect(track).toMatch(/border: 1px solid var\(--t-card-border\)/);
    const seg = css.slice(css.indexOf('\n.seg {'), css.indexOf('\n.seg {') + 420);
    expect(seg).toMatch(/border: 0/);
  });

  it('keeps the dark-mode fix SegPill already worked out', () => {
    // The selected chip used to be #171126 on a #111634 track: 1.04:1.
    expect(css).toMatch(/\.dark \.seg\.on \{ background: rgba\(255,255,255,\.16\)/);
  });
});
