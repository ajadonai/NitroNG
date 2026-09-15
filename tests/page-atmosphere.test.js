import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/**
 * The ground the dashboard sits on.
 *
 * There were two accent washes on the same corner of the same page, from two
 * layers that knew nothing about each other:
 *
 *   .dash-main            a rose radial, 900px tall, scrolling with the content
 *   .nitro-atmo::before   a rose + indigo band, 260px, fixed to the viewport
 *
 * Different origins, different extents, so they never lined up — and the first
 * is painted on the content column, so it began at a hard vertical edge beside
 * the sidebar while the second crossed it. That edge is what made the page look
 * wrong; the doubling is why turning one down would not have fixed it.
 *
 * The grain was never the problem and stays. It carries no colour and tiles
 * uniformly, so it has no seam to give away, and it is what keeps #0c0814 from
 * reading as a dead flat field.
 */
describe('the page atmosphere', () => {
  const dashMain = css.slice(css.indexOf('.dash-main {'), css.indexOf('.dash-main::before'));

  it('puts no colour wash on the content column, in either mode', () => {
    // Light's was the stronger of the two — .22 against dark's .16 — so this
    // was never a dark-mode-only fault.
    expect(dashMain).not.toMatch(/radial-gradient/);
    expect(css).not.toMatch(/radial-gradient\(120% 70% at 12% -6%/);
  });

  it('keeps the grain on that column, and only the grain', () => {
    expect(dashMain).toMatch(/feTurbulence/);
    // One layer now, so the multi-value background shorthands go back to single
    // values. A stale "100% 900px, 160px 160px" here would size the grain wrong.
    expect(dashMain).toMatch(/background-size: 160px 160px;/);
    expect(dashMain).toMatch(/background-repeat: repeat;/);
    expect(dashMain).not.toMatch(/background-size:.*,/);
  });

  it('keeps the aurora off the dashboard and on the pages people arrive on', () => {
    // Scoped rather than deleted: the landing and marketing pages are where an
    // aurora is doing a job, and they have no sidebar to seam against.
    expect(css).toMatch(/body:has\(\.dash-main\) \.nitro-atmo::before \{ content: none; \}/);
    // Still defined for everywhere else, in both modes.
    expect(css).toMatch(/\.nitro-atmo::before \{/);
    expect(css).toMatch(/\.dark \.nitro-atmo::before \{/);
  });

  it('keeps the grain everywhere, which is the part that was never wrong', () => {
    // Anchored forward from the rule itself: the .dash-main comment above names
    // .nitro-atmo::before, and that mention comes first in the file.
    const from = css.indexOf('.nitro-atmo {');
    const atmo = css.slice(from, css.indexOf('}', from) + 1);
    expect(atmo).toMatch(/feTurbulence/);
  });
});
