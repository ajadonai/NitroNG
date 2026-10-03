import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The CSP is what actually decides whether a tracking pixel loads — not
 * whether the init function was called. A script blocked by CSP fails
 * silently: no console error reaches Sentry, no exception is thrown, the
 * pixel simply never requests its own bundle and nothing ever fires. This
 * pins every tracking domain this site loads a script from or reports events
 * to, so adding one (as TikTok's pixel needed, 3 Oct) can't be forgotten the
 * same way a missing whitelist field was forgotten for the Auto chip.
 */
const config = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
const cspLine = config.match(/value: \[([\s\S]*?)\]\.join\('; '\)/)[1];
// script-src is a backtick template literal (it interpolates a dev-only
// 'unsafe-eval'); every other directive is a plain double-quoted string.
const directive = (name) => {
  const m = cspLine.match(new RegExp(`[\`"]${name} ([^\`"]*)[\`"]`));
  if (!m) throw new Error(`${name} not found in CSP`);
  return m[1];
};

describe('CSP allows the domains tracking scripts actually need', () => {
  it('loads the TikTok pixel bundle', () => {
    expect(directive('script-src')).toContain('https://analytics.tiktok.com');
  });

  it('lets the TikTok pixel report events back', () => {
    expect(directive('connect-src')).toContain('https://analytics.tiktok.com');
  });

  it('still allows Meta, unchanged by this edit', () => {
    expect(directive('script-src')).toContain('https://connect.facebook.net');
    expect(directive('connect-src')).toContain('https://connect.facebook.net');
  });
});
