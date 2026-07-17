import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  getPublicServiceLabel,
  PUBLIC_SERVICE_LABEL_MAX_LENGTH,
} from '@/lib/public-service-label';

const OPERATIONAL_METADATA = /\b(?:api|budget|cheap|day|days|drop|fast|guarantee|guaranteed|hq|hour|hours|hr|hrs|instant|lifetime|max|maximum|min|minimum|new|non-drop|organic|premium|provider|quality|rate|real|refill|speed|start|starts|starting|uhq)\b/i;
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\uFE0E\uFE0F\u20E3]/u;

describe('getPublicServiceLabel', () => {
  it.each([
    [
      '🟢 Instagram Followers | 30 Day Refill | Speed: 10-20K/Day | Max 500K | Low Drop | NEW!',
      'Instagram',
      'Instagram Followers',
    ],
    [
      '🔵 Instagram Real Quality Followers | 30 Day Refill | Speed: 10-50K/Day | Max 10M',
      'Instagram',
      'Instagram Followers',
    ],
    [
      '🟡 Instagram Photo Views | No Refill | Speed 50-100K/Day | Max 10M | NEW!',
      'Instagram',
      'Instagram Photo Views',
    ],
    [
      'TikTok Nigeria Followers [Nigeria 🇳🇬] [Refill: 60D] 50K/Day',
      'TikTok',
      'TikTok Nigerian Followers',
    ],
    [
      '🟢 X/Twitter Gradual Tweet Views | Spread Over 3 Hour | Max 100M | NEW',
      'Twitter/X',
      'X Tweet Views',
    ],
    [
      '🟢 YouTube Live Stream Views | 15 Minutes | Max 1M | NEW!',
      'YouTube',
      'YouTube Live Stream Views',
    ],
    [
      '🔵 Facebook Page Likes + Followers | 60 Day Refill | Speed 5-10K/Day | Max 1M',
      'Facebook',
      'Facebook Page Likes + Followers',
    ],
    [
      'Instagram Real Likes + Reach + Impressions | Lifetime Guaranteed | UHQ',
      'Instagram',
      'Instagram Likes + Reach + Impressions',
    ],
  ])('derives a canonical label from %s', (rawName, category, expected) => {
    expect(getPublicServiceLabel(rawName, category)).toBe(expected);
  });

  it('normalizes compatibility characters and removes controls, bidi marks, and emoji', () => {
    const raw = '\u202E🟢 Ｉｎｓｔａｇｒａｍ\u200B Ｆｏｌｌｏｗｅｒｓ\u0000 🇳🇬';
    expect(getPublicServiceLabel(raw)).toBe('Instagram Followers');
  });

  it('fails closed when no safe service identity can be derived', () => {
    expect(getPublicServiceLabel(null, 'Instagram')).toBe('Instagram Service');
    expect(getPublicServiceLabel('Mystery Package', 'Instagram')).toBe('Instagram Service');
    expect(getPublicServiceLabel('Mystery Package', 'Unknown')).toBe('Social Media Service');
    expect(getPublicServiceLabel('Instagram Followers and Facebook Likes')).toBe('Social Media Service');
  });

  it('fails closed on a platform mismatch instead of combining conflicting data', () => {
    expect(getPublicServiceLabel('Instagram Followers', 'Facebook')).toBe('Facebook Service');
  });

  it('does not copy markup, vendor text, or operational clauses into the label', () => {
    const raw = '<script>Vendor-Zeta-941</script> Instagram Followers | API 8842 | Refill: 365 Days | Speed: Instant';
    const label = getPublicServiceLabel(raw, 'Instagram');

    expect(label).toBe('Instagram Followers');
    expect(label).not.toContain('Vendor-Zeta-941');
    expect(label).not.toContain('<');
    expect(label).not.toMatch(OPERATIONAL_METADATA);
  });

  it('is idempotent for arbitrary Unicode provider names and contexts', () => {
    fc.assert(fc.property(
      fc.fullUnicodeString({ maxLength: 1_000 }),
      fc.fullUnicodeString({ maxLength: 200 }),
      (rawName, context) => {
        const once = getPublicServiceLabel(rawName, context);
        expect(getPublicServiceLabel(once, context)).toBe(once);
      },
    ), { numRuns: 500 });
  });

  it('never emits provider operational metadata', () => {
    const operationalClause = fc.constantFrom(
      '30 Day Refill',
      'Speed 10-50K/Day',
      'Max 10M',
      'Instant Start',
      'Lifetime Guaranteed',
      'Low Drop',
      'UHQ Premium Quality',
      'Provider API 8842',
    );

    fc.assert(fc.property(
      fc.fullUnicodeString({ maxLength: 300 }),
      fc.array(operationalClause, { minLength: 1, maxLength: 8 }),
      (noise, clauses) => {
        const rawName = `Instagram Followers ${noise} | ${clauses.join(' | ')}`;
        expect(getPublicServiceLabel(rawName, 'Instagram')).not.toMatch(OPERATIONAL_METADATA);
      },
    ), { numRuns: 300 });
  });

  it('always returns a non-empty bounded label without controls or emoji', () => {
    fc.assert(fc.property(
      fc.fullUnicodeString({ maxLength: 2_000 }),
      fc.fullUnicodeString({ maxLength: 300 }),
      (rawName, context) => {
        const label = getPublicServiceLabel(rawName, context);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
        expect(label.length).toBeLessThanOrEqual(PUBLIC_SERVICE_LABEL_MAX_LENGTH);
        expect(label).not.toMatch(CONTROL_OR_FORMAT);
        expect(label).not.toMatch(EMOJI);
      },
    ), { numRuns: 500 });
  });
});
