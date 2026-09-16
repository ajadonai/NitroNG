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
    expect(attrs).toContain('Instant');
  });

  it('reads lifetime guarantees and non-drop', () => {
    expect(serviceAttributes('Spotify Plays | Lifetime Guaranteed | Non Drop')).toContain('Lifetime guarantee');
    expect(serviceAttributes('🟢 Views | Non Drop | 10K/Day')).toContain('Non-drop');
  });

  it('invents no attribute a bare name did not state, beyond the start time', () => {
    // The start time is the one attribute every row gets whether the provider
    // stated it or not: a row silent about when it begins reads as slower than
    // a row marked Instant, which is not what silence means.
    expect(serviceAttributes('Instagram Followers')).toEqual(['0-24 hours']);
  });

  it('separates the two quality grades and never prints both', () => {
    // Spelled out. The abbreviation belongs to the narrow-screen row, not to
    // the vocabulary the reseller API sends.
    expect(serviceAttributes('Instagram Likes | USA | UHQ |')).toContain('Ultra high quality');
    expect(serviceAttributes('Instagram Likes | Ultra High Quality')).toContain('Ultra high quality');
    expect(serviceAttributes('Instagram Likes | Ultra High Quality')).not.toContain('High quality');
    expect(serviceAttributes('Instagram Likes | HQ Profiles')).toContain('High quality');
  });

  it('leaves a stated start time alone rather than blunting it to a day', () => {
    const attrs = serviceAttributes('Views [Start Time: 0-3 min]');
    expect(attrs).toContain('Starts in 0-3 min');
    expect(attrs).not.toContain('0-24 hours');
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
    // The default start time is a badge, not part of the name — a reseller's
    // storefront prints this label, and "Instagram Followers \u2014 0-24 hours"
    // would read as what the product is called.
    const r = formatResellerService('Instagram Followers', 'Instagram');
    expect(r.label).toBe(r.base);
    expect(r.attrs).toContain('0-24 hours');
  });
});
