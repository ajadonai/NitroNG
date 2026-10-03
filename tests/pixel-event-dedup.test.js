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
