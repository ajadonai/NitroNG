import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The full list has a guide of its own, because the tour cannot give it one.
 *
 * The order tour deliberately forces the curated view — its whole argument is
 * that Nitro tests the picks, and it would otherwise be walking somebody
 * through a list that says plainly it has tested nothing. So the densest row on
 * the site had nothing explaining it: an ID, three or four badges, a rating and
 * a price, each meaning something specific.
 */
const guide = readFileSync(new URL('../components/full-list-guide.jsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../components/full-list.jsx', import.meta.url), 'utf8');
const order = readFileSync(new URL('../components/new-order.jsx', import.meta.url), 'utf8');

describe('the full-list guide', () => {
  it('exists because the tour forces the curated view', () => {
    // If this ever stops being true the guide is redundant and the tour should
    // teach it instead.
    expect(order).toMatch(/if \(tourActive && view === "full"\) switchView\("nitro"\)/);
  });

  it('is reachable from the notice that sits above the list', () => {
    expect(list).toMatch(/setGuideOpen\(true\)/);
    expect(list).toMatch(/<FullListGuide open=\{guideOpen\}/);
  });

  it('teaches the six things a row actually carries', () => {
    for (const p of ['Service ID', 'Refill', 'Start time',
      'Quality grade', 'Save', 'Buyer votes']) {
      expect(guide, p).toContain(p);
    }
  });

  it('leads with the thing the list is, not with the features', () => {
    expect(guide).toMatch(/Nitro hasn't tested these/);
  });

  /**
   * The redesign, 18 Sep 2026. The sheet argued for an annotated row and then
   * drew six chips in a column with a paragraph each — 1,060 characters about
   * things sitting three centimetres away on the list behind it. Naming a badge
   * in the abstract costs a sentence; pointing at it costs four words.
   */
  it('draws the row it is explaining, and keys the lines to it', () => {
    // A real row: the id, the badges it carries, the star and the price.
    expect(guide).toContain('#4821');
    expect(guide).toContain('UHQ');
    expect(guide).toContain('₦1,450');
    // Six numbered pins on the row, six numbered lines under it.
    expect(guide).toMatch(/<Pin n=\{1\} \/>/);
    expect(guide).toMatch(/<Pin n=\{6\} \/>/);
  });

  it('keeps every line short enough to read at a glance', () => {
    // The old sheet ran to 250 characters a point. Nothing here may.
    const points = [...guide.matchAll(/tr\("([^"]{25,})"\)/g)].map(m => m[1]);
    expect(points.length).toBeGreaterThan(5);
    for (const p of points) expect(p.length, p).toBeLessThanOrEqual(100);
  });

  it('places its pins without measuring the page', () => {
    // Pins are children of the elements they mark. Absolute positioning driven
    // by getBoundingClientRect needs a resize listener, and a translated label
    // drags the pin off its badge before the listener fires.
    expect(guide).not.toMatch(/getBoundingClientRect/);
    expect(guide).not.toMatch(/addEventListener\("resize"/);
    // And the offset is logical, so the RTL build has no physical rule to
    // mirror — the [dir] specificity trap in CLAUDE.md.
    expect(guide).toMatch(/insetInlineEnd/);
    expect(guide).not.toMatch(/insetInlineEnd[^,}]*\bright:/);
  });

  it('follows the house modal rules', () => {
    // The page behind does not scroll, the backdrop closes it and does nothing
    // else, and the surface is an opaque card rather than a translucent token.
    expect(guide).toMatch(/document\.body\.style\.overflow = "hidden"/);
    expect(guide).toMatch(/onClick=\{onClose\}/);
    expect(guide).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
    expect(guide).toMatch(/const card = dark \? "#171126" : "#ffffff"/);
    expect(guide).toMatch(/aria-modal="true"/);
  });

  it('can be reopened, unlike a tour that fires once', () => {
    expect(list).toMatch(/const \[guideOpen, setGuideOpen\] = useState\(false\)/);
    expect(guide).not.toMatch(/localStorage/);
  });

  it('restores the scroll it took', () => {
    expect(guide).toMatch(/const prev = document\.body\.style\.overflow;/);
    expect(guide).toMatch(/document\.body\.style\.overflow = prev;/);
  });
});
