import { describe, expect, it } from 'vitest';
import { isAutoService, autoTargetFrom, autoTargetLabel, autoTargetError } from '@/lib/auto-services';

describe('isAutoService', () => {
  it('recognises the provider marker however it is cased or padded', () => {
    expect(isAutoService({ apiType: 'Subscriptions' })).toBe(true);
    expect(isAutoService({ apiType: 'subscriptions' })).toBe(true);
    expect(isAutoService({ apiType: '  Subscriptions ' })).toBe(true);
  });

  it('leaves every other type alone', () => {
    for (const t of ['Default', 'Package', 'Custom Comments', 'SEO', 'Web Traffic', '', null, undefined]) {
      expect(isAutoService({ apiType: t }), String(t)).toBe(false);
    }
    expect(isAutoService(null)).toBe(false);
  });
});

describe('autoTargetFrom — the post links that were silently accepted', () => {
  // The exact links from the orders Trip reported. Each produced username
  // "reel" under the old regex and dispatched anyway.
  it.each([
    'https://www.instagram.com/reel/DdT2v2qtD-R/',
    'https://instagram.com/reel/DdbeB1bqkaj/',
    'https://www.instagram.com/p/Cxyz123/',
    'https://www.instagram.com/reels/Cabc999/',
    'https://www.instagram.com/tv/Cdef456/',
    'https://www.instagram.com/stories/someone/123456/',
  ])('refuses %s', (link) => {
    expect(autoTargetFrom(link, 'instagram')).toBeNull();
  });

  it('accepts the two shapes that actually worked', () => {
    expect(autoTargetFrom('https://www.instagram.com/whytestories', 'instagram')).toBe('whytestories');
    expect(autoTargetFrom('https://www.instagram.com/blizz__photography', 'instagram')).toBe('blizz__photography');
  });

  it('accepts a profile with a trailing slash or query junk', () => {
    expect(autoTargetFrom('https://instagram.com/someone/', 'instagram')).toBe('someone');
    expect(autoTargetFrom('https://instagram.com/someone?igshid=abc', 'instagram')).toBe('someone');
  });

  it('accepts a bare handle, which is what people paste when asked for a profile', () => {
    expect(autoTargetFrom('someone', 'instagram')).toBe('someone');
    expect(autoTargetFrom('@someone', 'instagram')).toBe('someone');
  });
});

describe('autoTargetFrom — the platforms the old regex ignored entirely', () => {
  it('reads a TikTok profile and refuses a TikTok video', () => {
    expect(autoTargetFrom('https://www.tiktok.com/@someone', 'tiktok')).toBe('someone');
    expect(autoTargetFrom('https://www.tiktok.com/@someone/video/7123', 'tiktok')).toBeNull();
    // Without the @ it is not an account path at all.
    expect(autoTargetFrom('https://www.tiktok.com/discover/x', 'tiktok')).toBeNull();
  });

  it('reads a YouTube channel in each of its forms and refuses a video', () => {
    expect(autoTargetFrom('https://youtube.com/@somechannel', 'youtube')).toBe('somechannel');
    expect(autoTargetFrom('https://youtube.com/channel/UCabc123', 'youtube')).toBe('UCabc123');
    expect(autoTargetFrom('https://youtube.com/c/SomeName', 'youtube')).toBe('SomeName');
    expect(autoTargetFrom('https://youtube.com/user/somename', 'youtube')).toBe('somename');
    expect(autoTargetFrom('https://youtube.com/watch?v=abc123', 'youtube')).toBeNull();
    expect(autoTargetFrom('https://youtube.com/shorts/abc123', 'youtube')).toBeNull();
    expect(autoTargetFrom('https://youtu.be/abc123', 'youtube')).toBeNull();
  });

  it('reads a Telegram channel and refuses a single message', () => {
    expect(autoTargetFrom('https://t.me/somechannel', 'telegram')).toBe('somechannel');
    expect(autoTargetFrom('https://t.me/somechannel/1234', 'telegram')).toBeNull();
    expect(autoTargetFrom('https://t.me/s/somechannel', 'telegram')).toBeNull();
  });
});

describe('autoTargetFrom — refusing rather than guessing', () => {
  it('returns null for empty and malformed input', () => {
    for (const v of ['', '   ', null, undefined, 'http://', 'not a url at all!!']) {
      expect(autoTargetFrom(v, 'instagram'), String(v)).toBeNull();
    }
  });

  it('returns null for a host we do not have auto services for', () => {
    expect(autoTargetFrom('https://facebook.com/someone', 'facebook')).toBeNull();
    expect(autoTargetFrom('https://example.com/someone', 'instagram')).toBeNull();
  });
});

describe('what the customer is asked for', () => {
  it('says channel for the platforms that have channels, profile otherwise', () => {
    expect(autoTargetLabel('telegram')).toBe('Channel link');
    expect(autoTargetLabel('youtube')).toBe('Channel link');
    expect(autoTargetLabel('instagram')).toBe('Profile link');
    expect(autoTargetLabel('tiktok')).toBe('Profile link');
  });

  it('explains the refusal in terms of what the service does', () => {
    expect(autoTargetError('instagram')).toMatch(/future posts/);
    expect(autoTargetError('instagram')).toMatch(/profile link/);
    expect(autoTargetError('telegram')).toMatch(/channel link/);
  });
});
