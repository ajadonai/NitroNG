import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/api/telegram/webhook/route.js', import.meta.url), 'utf8');

/**
 * Margin and markup have been swapped for each other once already: /stats
 * printed (rev - cost) / cost under the name `margin`, so a day read 266%
 * beside a month at 63% and looked like two different businesses.
 *
 * Both numbers are true and neither is "the" percentage, so both are printed
 * and both are labelled. These assertions exist so a future tidy-up cannot
 * quietly drop one or relabel the other.
 */
const margin = (rev, cost) => (rev > 0 ? Math.round(((rev - cost) / rev) * 100) : null);
const markup = (rev, cost) => (cost > 0 ? Math.round(((rev - cost) / cost) * 100) : null);

describe('the two profit percentages', () => {
  it('divides by different things, which is the whole point', () => {
    // Real production figures for today when this was written.
    const [rev, cost] = [252288, 78201];
    expect(margin(rev, cost)).toBe(69);
    expect(markup(rev, cost)).toBe(223);
    expect(margin(rev, cost)).not.toBe(markup(rev, cost));
  });

  it('defines margin against revenue', () => {
    expect(src).toMatch(/const margin = \(rev, cost\) => rev > 0 \? `\$\{Math\.round\(\(\(rev - cost\) \/ rev\) \* 100\)\}%`/);
  });

  it('defines markup against cost', () => {
    expect(src).toMatch(/const markup = \(rev, cost\) => cost > 0 \? `\$\{Math\.round\(\(\(rev - cost\) \/ cost\) \* 100\)\}%`/);
  });

  it('never divides by cost under the name margin — the original bug', () => {
    expect(src).not.toMatch(/const margin = .*\(rev - cost\) \/ cost/);
  });

  it('prints both on every profit line', () => {
    const lines = src.split('\n').filter(l => l.includes('Profit: <b>'));
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const l of lines) {
      expect(l, l.trim().slice(0, 60)).toContain('margin');
      expect(l, l.trim().slice(0, 60)).toContain('on cost');
    }
  });

  it('guards both denominators, so a quiet day shows a dash not Infinity', () => {
    expect(margin(0, 0)).toBeNull();
    expect(markup(100, 0)).toBeNull();
    expect(src).toMatch(/const markup = \(rev, cost\) => cost > 0 \?.*: '—'/);
  });
});
