import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LOADER_COLORS, NAV_BAR_DELAY_MS, NAV_BAR_MIN_MS, barShows } from '../components/nav-progress.jsx';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
const loaderSrc = readFileSync(new URL('../components/nitro-loader.jsx', import.meta.url), 'utf8');

/**
 * The strip that runs while a page loads, and the line under the nav.
 */
describe('the navigation strip', () => {
  it('uses the loading mark’s own four colours, not a new palette', () => {
    // A slow navigation and a cold start should look like the same brand doing
    // the same thing. If nitro-loader ever re-picks its colours, this fails
    // rather than quietly drifting apart.
    const inLoader = loaderSrc.match(/const COLORS = \[([^\]]+)\]/)[1];
    for (const c of LOADER_COLORS) expect(inLoader, `${c} is no longer a loader colour`).toContain(c);
    for (const c of LOADER_COLORS) expect(css, `${c} missing from the strip gradient`).toContain(c);
  });

  it('says nothing about a navigation too quick to be worth announcing', () => {
    // Most page changes here are one frame. A bar for 80ms reads as a fault,
    // not as loading.
    expect(barShows(60)).toBe(false);
    expect(barShows(NAV_BAR_DELAY_MS)).toBe(false);
    expect(barShows(NAV_BAR_DELAY_MS + 1)).toBe(true);
  });

  it('stays long enough to be read once it has appeared', () => {
    expect(NAV_BAR_MIN_MS).toBeGreaterThan(NAV_BAR_DELAY_MS);
  });

  it('creeps without arriving, and completes only when the page does', () => {
    // A bar that reached 100% on a timer would claim knowledge of how long a
    // chunk takes, which nothing here has.
    expect(css).toMatch(/@keyframes navFill \{ 0% \{ width: 4%; \} 55% \{ width: 62%; \} 100% \{ width: 93%; \} \}/);
    expect(css).toMatch(/\.nitro-navbar\.done i \{ animation: none; width: 100%;/);
  });

  it('shows all four colours at any width, not just the first', () => {
    // transform: scaleX squashes what has already been painted, so a bar at
    // scaleX(.04) showed the leftmost 4% of the gradient — pink, and only pink.
    // Width leaves the gradient sized to the visible bar instead.
    expect(css).not.toMatch(/\.nitro-navbar i \{[^}]*transform: scaleX/s);
    expect(css).toMatch(/\.nitro-navbar i \{[^}]*background-size: 100% 100%/s);
    // Pink leads and the rest trail, the order the mark itself draws in:
    // NitroLoader paints four copies 75ms apart with pink undelayed on top.
    // The bar grows rightward, so pink sits at the right-hand leading edge.
    // Scoped to the bar's own rule. This used to take the first 90deg gradient
    // anywhere in the sheet, so it broke the moment another rule above it in
    // the file happened to use one — which is a test failing about a stranger.
    const rule = css.match(/\.nitro-navbar i \{[^}]*\}/s)[0];
    const grad = rule.match(/linear-gradient\(90deg, (#[^)]*)\)/)[1];
    const order = [...grad.matchAll(/#[0-9a-f]{6}/g)].map(m => m[0]);
    expect(order[0]).toBe('#ecc94b');
    expect(order[order.length - 1]).toBe('#c47d8e');
  });

  it('is fixed, above the nav and below a modal', () => {
    // .dash-root is not a positioned ancestor and making it one would restack
    // everything inside it.
    expect(css).toMatch(/\.nitro-navbar \{ position: fixed;/);
    expect(css).toMatch(/\.nitro-navbar \{[^}]*z-index: 60;/);
  });

  it('still shows a strip when motion is turned down', () => {
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .nitro-navbar i'));
    expect(rm.slice(0, 260)).toMatch(/animation: none; width: 100%/);
  });

  it('is driven by the page actually painting, not by a timer alone', () => {
    // Two frames: one for React to commit, one for the browser to draw.
    expect(dash).toMatch(/const raf1 = requestAnimationFrame\(\(\) => \{/);
    expect(dash).toMatch(/raf2 = requestAnimationFrame\(\(\) => \{ timer = setTimeout\(\(\) => setNavBusy\(false\), NAV_BAR_MIN_MS\); \}\);/);
    expect(dash).toMatch(/\}, \[active\]\);/);
  });
});

describe('the rule under the nav', () => {
  it('is the same line as the sidebars, not its own formula', () => {
    // Nav and sidebars provably match, because they read one token.
    expect(css).toMatch(/\.dash-nav \{[^}]*border-bottom: 1px solid var\(--t-sidebar-border\)/s);
  });

  it('keeps every line rose, and strong enough to see', () => {
    // These were always the accent darkened — 139,74,94 — but at .13 and .16
    // they measured 1.20:1 against the card behind them, the contrast of a grey
    // hairline. The colour was there and nobody could tell.
    const tok = (name, mode) => {
      const block = mode === 'dark'
        ? css.slice(css.indexOf('--t-bg: #0c0814'))
        : css.slice(css.indexOf('--t-bg: #efe8e0'), css.indexOf('--t-bg: #0c0814'));
      return Number(block.match(new RegExp(`${name}: rgba\\([^)]*?([\\d.]+)\\)`))[1]);
    };
    for (const mode of ['light', 'dark']) {
      const card = tok('--t-card-border', mode);
      const rail = tok('--t-sidebar-border', mode);
      expect(card, `${mode} card edge too faint to read as a line`).toBeGreaterThanOrEqual(0.2);
      // Structure sits above card edges: nav and sidebars are the skeleton,
      // a card border is the outline of one object.
      expect(rail, `${mode} structural line should outrank a card edge`).toBeGreaterThan(card);
    }
  });

  it('is not drawn twice — the nav element stops carrying its own', () => {
    expect(dash).toMatch(/<nav className="dash-nav bg-t-sidebar-bg">/);
    expect(dash).not.toMatch(/dash-nav bg-t-sidebar-bg border-b/);
  });
});

/**
 * Half a pixel of any colour is a smudge.
 *
 * Strengthening the line tokens did nothing wherever the border was 0.5px: a
 * browser cannot draw half a device pixel, so it either rounds the width up and
 * drops the opacity to compensate, or loses the line entirely depending on the
 * display. That is why lines still read as faint on some screens after the
 * colour was fixed — the colour was never the whole problem.
 */
describe('no line is drawn at half a pixel', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

  it('has none left in the CSS dividers', () => {
    const g = read('app/globals.css');
    expect(g).not.toMatch(/\.dash-sidebar-divider \{ height: 0\.5px/);
    expect(g).not.toMatch(/\.adm-card-divider \{ height: 0\.5px/);
  });

  it('has none left in the components that were swept', () => {
    for (const f of ['components/dashboard.jsx', 'components/admin-dashboard.jsx',
                     'components/orders-page.jsx', 'components/new-order.jsx',
                     'components/full-list.jsx', 'components/blog-post.jsx']) {
      expect(read(f), `${f} still draws a border at 0.5px`).not.toMatch(/0\.5px solid|border[a-z-]*-\[0\.5px\]/);
    }
  });

  it('leaves letter-spacing alone, which is a different 0.5px', () => {
    // tracking-[0.5px] is type, not a line, and a blanket replace would have
    // silently respaced sixteen labels.
    const dash = read('components/dashboard.jsx');
    expect(dash).toMatch(/tracking-\[0\.5px\]|tracking-\[1\.5px\]/);
  });

  it('leaves the landing pages to their own palette', () => {
    // Their borders are white-alpha against a rose hero and dark bands, not
    // cream-and-dark cards, and a redesign of them is parked on the shelf.
    expect(read('components/landing-v3.jsx')).toMatch(/0\.5px solid/);
  });
});
