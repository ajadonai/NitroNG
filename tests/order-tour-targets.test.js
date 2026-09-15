import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const tour = readFileSync(new URL('../components/order-tour.jsx', import.meta.url), 'utf8');
const dir = join(process.cwd(), 'components');
const all = readdirSync(dir).filter(f => f.endsWith('.jsx'))
  .map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
// Everything except the tour itself — the tour naming a class proves nothing.
const rendered = readdirSync(dir).filter(f => f.endsWith('.jsx') && f !== 'order-tour.jsx')
  .map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

/**
 * Every selector the tour aims at must exist on the page.
 *
 * This is the test that was missing. Four platform selectors — no-plat-icon-on,
 * no-mob-plat-on, no-plat-icon-btn, no-mob-plat-btn — stopped being rendered
 * and nothing noticed, because findTarget falls back to the step's anchor when
 * findFirst matches nothing. It does not throw, it does not warn: it quietly
 * points at the nearest ancestor. So step one went on explaining "Instagram,
 * TikTok, YouTube" while circling the Social / Music / SEO & Reviews tabs.
 *
 * A silent fallback is the right behaviour at runtime — a customer should never
 * see a tour crash. It is the wrong behaviour in CI, which is what this is for.
 */
describe('every tour step points at something real', () => {
  const targets = [...tour.matchAll(/target: "([a-z-]+)"/g)].map(m => m[1]);
  const finders = [...tour.matchAll(/findFirst: "([^"]+)"/g)].map(m => m[1]);

  it('has a step list worth checking', () => {
    expect(targets.length).toBeGreaterThanOrEqual(6);
  });

  it('anchors on a data-tour attribute that is actually rendered', () => {
    const missing = targets.filter(t => !rendered.includes(`data-tour="${t}"`));
    expect(missing, `no element renders these anchors: ${missing.join(', ')}`).toEqual([]);
  });

  it('aims findFirst at a class that is actually rendered', () => {
    // The exact failure that went unseen: a class named only by the tour.
    const dead = [];
    for (const sel of finders) {
      for (const one of sel.split(',').map(x => x.trim())) {
        const cls = one.replace(/^\./, '').replace(/:.*$/, '');
        if (cls && !rendered.includes(cls)) dead.push(one);
      }
    }
    expect(dead, `these tour selectors match nothing on the page: ${dead.join(', ')}`).toEqual([]);
  });

  it('leads with the list selector, which the rest of the page hangs off', () => {
    expect(targets[0]).toBe('no-list-select');
  });

  it('still shows how an order is placed', () => {
    // Dropped once in a rebuild, which took the tour from "enter your link"
    // straight to bulk mode without ever placing anything.
    expect(targets).toContain('no-submit-btn');
    // NOT no-order-bar: that strip is mobile/tablet only and sits under the
    // modal that the tier step opens, so on desktop it pointed at nothing.
    expect(targets).not.toContain('no-order-bar');
  });

  it('renders above the order modal the tier step opens', () => {
    // handleSelectTier calls setOrderModal(true), so the modal is up for the
    // last three steps. At z-101 against its z-200 the tour was simply behind
    // it: the form appeared and the step vanished.
    expect(tour).toMatch(/z-\[210\]/);
    expect(tour).not.toMatch(/fixed inset-0 w-full h-full z-\[100\]/);
    expect([...tour.matchAll(/z-\[211\]/g)].length).toBeGreaterThanOrEqual(3);
  });

  it('quotes no catalogue counts, which are per-platform and go stale', () => {
    // "we support 28" outlived the 29th platform. Instagram carries 19 picks
    // and 934 others; YouTube's wider list is 1,422. Any number typed here is
    // wrong for most people reading it — the live pills say it instead.
    const steps = tour.slice(tour.indexOf('const STEPS = ['), tour.indexOf('\n];'));
    const copy = [...steps.matchAll(/msg\("([^"]+)"\)/g)].map(m => m[1]).join(' ');
    // Catalogue-sized numbers, and any count attached to services/platforms.
    // "refilled for 30 days" is a product fact and stays — it does not drift
    // every time the sync runs.
    expect(copy, 'a catalogue-sized number in tour copy').not.toMatch(/\b\d{3,}\b/);
    expect(copy, 'a count of services or platforms').not.toMatch(/\d+\s*(services?|platforms?)/i);
    expect(copy).not.toMatch(/\bwe support\b/i);
  });

  it('takes the first VISIBLE match, since the platform grid renders twice', () => {
    expect(tour).toMatch(/function firstVisible\(sel\)/);
    expect(all).toMatch(/data-tour="no-platform-grid"/);
    // Both the desktop grid and the phone window carry the anchor.
    expect([...rendered.matchAll(/data-tour="no-platform-grid"/g)]).toHaveLength(2);
  });
});

describe('the tour card never covers what it points at', () => {
  it('reserves the floating bottom nav, which exists at 1199 and under', () => {
    expect(tour).toMatch(/const navH = window\.innerWidth <= 1199 \? 74 : 0;/);
    expect(tour).toMatch(/const spaceBelow = floor - spotBottom;/);
  });

  it('sits against an edge rather than on the target when neither side fits', () => {
    // The old last resort was `top = Math.max(70, spotBottom + gap)`, which
    // lands ON the spotlight. Place-your-order is exactly that case: the order
    // bar is pinned to the bottom of the screen itself.
    expect(tour).not.toMatch(/Math\.max\(70, spotBottom \+ gap\)/);
    expect(tour).toMatch(/pos\.top = Math\.min\(spotBottom \+ gap, floor - tooltipH - 10\)/);
  });

  it('ripples three times and stops, and not at all under reduced motion', () => {
    expect(tour).toMatch(/repeatCount="3"/);
    expect(tour).not.toMatch(/repeatCount="indefinite"/);
    expect(tour).toMatch(/prefers-reduced-motion: reduce/);
    expect(tour).toMatch(/\{!reduceMotion && \(/);
  });
});

/**
 * The card has to be readable, which it measurably was not.
 *
 * "Skip tour" and "Esc to exit" ran at 2.12:1 on the white card and 3.22:1 on
 * the dark one, against WCAG's 4.5:1 for normal text at those sizes — Trip's
 * word was "almost invisible", which is what 2:1 looks like. Body copy was also
 * short in light mode at 3.95:1.
 */
describe('the tour card can be read', () => {
  it('never shows a Top up button on the step that teaches ordering', () => {
    // Three attempts at this. Guessing from user.balance (wrong: kobo),
    // then retitling the step (wrong: turned an ordering lesson into a top-up
    // lesson for the ~100% of tour-takers who have ₦0), then explaining the
    // wrong button. The answer was to remove the wrong button: the form
    // assumes the wallet covers it while the tour is up.
    const src = readFileSync(new URL('../components/order-tour.jsx', import.meta.url), 'utf8');
    const form = readFileSync(new URL('../components/order-form.jsx', import.meta.url), 'utf8');
    const newOrder = readFileSync(new URL('../components/new-order.jsx', import.meta.url), 'utf8');
    expect(form).toMatch(/const short = !assumeFunded && balance != null/);
    expect(newOrder).toMatch(/<OrderForm assumeFunded=\{tourActive\}/);
    // And no leftovers from the two attempts that wrote around it.
    expect(src).not.toMatch(/emptyTitle|emptyDesc|needsFunds|submitMode/);
    expect(src).toMatch(/const stepDesc = STEPS\[step\]\?\.desc;/);

    // Safe only because the tour's overlay swallows clicks to everything under
    // it, so the button it shows cannot be pressed while the tour is up.
    expect(src).toMatch(/<svg aria-hidden="true" className="fixed inset-0 w-full h-full z-\[210\]"/);
  });

  it('drops the hardcoded duration from the welcome card', () => {
    // "takes about 15 seconds" was written for six steps and is wrong at seven
    // — the same kind of unmaintained claim as "we support 28".
    const src = readFileSync(new URL('../components/order-tour.jsx', import.meta.url), 'utf8');
    // Scoped to copy, not comments — the note explaining the removal names it.
    expect(src).not.toMatch(/(tr|msg)\("Quick walkthrough/);
    // Also scoped past the comment: it names the old path to explain the swap.
    const jsx = src.slice(src.indexOf('phase === "welcome" && ('));
    expect(jsx.slice(0, 2600)).not.toMatch(/d="M12 5v14M5 12h14"/);
  });

  it('shows what a deposit leaves you to spend', () => {
    const src = readFileSync(new URL('../components/order-tour.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/money\(p\.amount \+ p\.bonus, \{ round: "down" \}\)\} \{tr\("to spend"\)\}/);
  });

  const tourSrc = readFileSync(new URL('../components/order-tour.jsx', import.meta.url), 'utf8');
  const over = (fg, a, bg) => fg.map((f, i) => Math.round(bg[i] + (f - bg[i]) * a));
  const lum = (c) => {
    const f = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const cr = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const WHITE = [255, 255, 255], CARD_DARK = [26, 19, 41];

  const alpha = (name, mode) => {
    const line = tourSrc.split('\n').find(l => l.includes(`const ${name} = dark ?`));
    const m = [...line.matchAll(/rgba\([^)]*?([\d.]+)\)/g)].map(x => Number(x[1]));
    return mode === 'dark' ? m[0] : m[1];
  };

  for (const name of ['sub', 'skipC']) {
    it(`${name} clears 4.5:1 in both themes`, () => {
      const light = cr(over([0, 0, 0], alpha(name, 'light'), WHITE), WHITE);
      const darkC = cr(over([255, 255, 255], alpha(name, 'dark'), CARD_DARK), CARD_DARK);
      expect(light, `${name} on the white card is ${light.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(darkC, `${name} on the dark card is ${darkC.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('leads the card with the heading, not with three rows of chrome', () => {
    // "STEP 1 OF 6" in accent caps plus an "Esc to exit" chip took the whole
    // header and pushed the actual heading to a third row. The rail already
    // says how far along you are.
    expect(tourSrc).not.toMatch(/tracking-\[1\.5px\] uppercase/);
    expect(tourSrc).toMatch(/\{tr\(stepTitle\)\}<\/div>\s*<\/div>/);
    // Still announced, just not shouted.
    expect(tourSrc).toMatch(/aria-label=\{`\$\{tr\("Step"\)\} \$\{step \+ 1\}/);
  });
});
