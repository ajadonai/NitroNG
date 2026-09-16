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
    for (const p of ['The service ID', 'What happens if it drops', 'When it starts',
      'What the accounts are like', 'Save it for next time', 'What other buyers said']) {
      expect(guide, p).toContain(p);
    }
  });

  it('leads with the thing the list is, not with the features', () => {
    expect(guide).toMatch(/Nitro has not tested anything here/);
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
