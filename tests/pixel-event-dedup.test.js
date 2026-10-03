import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * One event, two transports, one id. Browser and server both report every
 * event; the platform collapses the pair only when the `event` name AND the
 * id match. Get the id wrong and nothing errors — the dashboards simply show
 * double the conversions and optimisation trains on inflated numbers, which is
 * the failure the TikTok build spec calls "the recurring Meta bug".
 *
 * Each pixel spells the field differently, which is most of why it gets missed:
 *   Meta   — fbq('track', name, data, { eventID })      4th arg, capital ID
 *   TikTok — ttq.track(name, props, { event_id })       3rd arg, snake_case
 * Both must receive the same `eventId` that goes to /api/capi/track.
 */
const src = readFileSync(new URL('../components/capi-tracker.jsx', import.meta.url), 'utf8');

describe('browser pixels share one event id with the server', () => {
  it('mints exactly one id per fire', () => {
    const assignments = src.match(/const eventId =/g) || [];
    expect(assignments).toHaveLength(1);
  });

  it('hands that id to Meta as eventID', () => {
    expect(src).toMatch(/window\.fbq\([^;]*\{\s*eventID:\s*eventId\s*\}/);
  });

  it('hands that same id to TikTok as event_id', () => {
    expect(src).toMatch(/window\.ttq\.track\([^;]*\{\s*event_id:\s*eventId\s*\}/);
  });

  it('sends that same id to the server, so the pair can be matched', () => {
    expect(src).toMatch(/event_id:\s*eventId/);
  });

  // ttq.page() takes no event_id, so a server-side Pageview could never be
  // deduplicated against it. Asserting the absence keeps someone from "fixing
  // the gap" by adding one and silently double-counting every page view.
  it('uses ttq.page() for page views rather than a track call', () => {
    expect(src).toMatch(/window\.ttq\.page\(\)/);
    expect(src).not.toMatch(/ttq\.track\(\s*['"]Pageview['"]/i);
  });
});

/**
 * Both pixel initialisers used to fire a PageView of their own, and because
 * <CookieBanner /> sits above <CAPIPageView /> in the layout its effect ran
 * first — so a returning visitor with stored consent got one PageView from the
 * initialiser and a second from the tracker. Meta's browser page views were
 * roughly doubled for as long as both existed. The tracker owns PageView now.
 */
// Comments stripped: these assert on what the code does, and both the block
// comment explaining why ttq.page() was dropped and the one naming the old
// fbq('track','PageView') would otherwise match as if they were still calls.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const banner = stripComments(readFileSync(new URL('../components/cookie-banner.jsx', import.meta.url), 'utf8'));

describe('only one place fires a page view', () => {
  it('does not fire a Meta PageView from the initialiser', () => {
    expect(banner).toMatch(/window\.fbq\('init'/);
    expect(banner).not.toMatch(/fbq\(\s*['"]track['"]\s*,\s*['"]PageView['"]/);
  });

  it('does not fire a TikTok page view from the initialiser', () => {
    expect(banner).toMatch(/ttq\.load\(/);
    // The vendor snippet ends with ttq.page(); dropping it is deliberate.
    expect(banner).not.toMatch(/ttq\.page\(\)/);
  });

  it('announces consent on the stored-consent path too, so order cannot matter', () => {
    // Two dispatches: one when a choice is saved, one when a stored choice is
    // replayed on mount. The second is what frees the browser PageView from
    // depending on sibling order in the layout.
    const dispatches = banner.match(/nitro-consent-changed/g) || [];
    expect(dispatches.length).toBeGreaterThanOrEqual(2);
  });

  it('captures the TikTok click id the server side reads back', () => {
    expect(banner).toMatch(/_ttclid=/);
    expect(banner).toMatch(/ensureTtclidFromClick\(\)/);
  });
});
