import { describe, expect, it } from 'vitest';
import { gradeOf, serviceAttributes, formatResellerService } from '@/lib/reseller-format';

describe('gradeOf', () => {
  it('reads the three MTP grades', () => {
    expect(gradeOf('🔵 Twitch Followers | Max 10K')).toBe('premium');
    expect(gradeOf('🟢 Instagram Video Views')).toBe('standard');
    expect(gradeOf('🟡 Youtube Views | No Refill')).toBe('basic');
  });

  // DAO has no grading; a flag emoji is geo, not quality. Returning null (and
  // never a low grade) is what stops ungraded services reading as bad ones.
  it('returns null for ungraded and flag-led names', () => {
    expect(gradeOf('TikTok Followers [Refill: No] [Cheapest]')).toBeNull();
    expect(gradeOf('🇺🇸 Instagram Followers USA')).toBeNull();
    expect(gradeOf('')).toBeNull();
  });
});

describe('serviceAttributes', () => {
  it('extracts refill period, speed and qualifiers', () => {
    const attrs = serviceAttributes('🟢 🇺🇸 X/Twitter Followers | USA | 7 Day Refill | Speed: 1-5K/Day | Max 10K | Instant Start |');
    expect(attrs).toContain('7-day refill');
    expect(attrs).toContain('1-5K/day');
    expect(attrs).toContain('Instant start');
  });

  it('reads lifetime guarantees and non-drop', () => {
    expect(serviceAttributes('Spotify Plays | Lifetime Guaranteed | Non Drop')).toContain('Lifetime guarantee');
    expect(serviceAttributes('🟢 Views | Non Drop | 10K/Day')).toContain('Non-drop');
  });

  it('returns empty for a bare name rather than inventing anything', () => {
    expect(serviceAttributes('Instagram Followers')).toEqual([]);
  });
});

describe('formatResellerService', () => {
  // The entire point: two services that cleaned to the same storefront label
  // must come out distinguishable.
  it('separates services the storefront cleaner collapses together', () => {
    const a = formatResellerService('🟢 🇺🇸 X/Twitter Followers | USA | Speed: 1-5K/Day | Max 10K | Instant Start |', 'Twitter/X');
    const b = formatResellerService('🟢 🇺🇸 X/Twitter Followers | USA | 7 Day Refill | Speed: 1-5K/Day | Max 10K | Instant Start |', 'Twitter/X');
    expect(a.base).toBe(b.base);
    expect(a.label).not.toBe(b.label);
  });

  it('leaves an attribute-less name as the clean label alone', () => {
    const r = formatResellerService('Instagram Followers', 'Instagram');
    expect(r.label).toBe(r.base);
  });
});
