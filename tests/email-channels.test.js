import { describe, expect, it } from 'vitest';
import { channelList, pickChannel, emailWrap, fillChannels } from '@/lib/email';

/**
 * The channel card that replaced the WhatsApp-only one (17 Oct 2026).
 *
 * It rotates between WhatsApp, Instagram, TikTok and X, picked from the
 * recipient and the Lagos date: a person sees a different channel from email
 * to email, and a day's sends split evenly instead of all landing on one.
 */
const settings = { wa: 'https://whatsapp.com/channel/abc', social_instagram: 'https://instagram.com/Nitro.ng/', social_twitter: '@TheNitroNG', social_tiktok: 'tiktok.com/@nitro.ng' };

describe('channelList', () => {
  it('turns whatever was typed in Admin into a clean handle', () => {
    const list = channelList(settings);
    expect(list.map(c => c.key)).toEqual(['wa', 'ig', 'tt', 'x']);
    expect(list.find(c => c.key === 'ig')).toMatchObject({ title: '@Nitro.ng on Instagram', url: 'https://instagram.com/Nitro.ng' });
    expect(list.find(c => c.key === 'tt')).toMatchObject({ title: '@nitro.ng on TikTok', url: 'https://tiktok.com/@nitro.ng' });
    expect(list.find(c => c.key === 'x').url).toBe('https://x.com/TheNitroNG');
  });

  it('skips TikTok when no handle is set, and falls back for the rest', () => {
    const list = channelList({});
    expect(list.map(c => c.key)).toEqual(['wa', 'ig', 'x']);
    expect(list[0].url).toMatch(/^https:\/\/whatsapp\.com\/channel\//);
  });
});

describe('pickChannel', () => {
  const list = channelList(settings);
  const day = (n) => new Date(Date.UTC(2026, 9, 17 + n, 12));

  it('gives one person a different channel on consecutive days', () => {
    const seen = new Set([0, 1, 2, 3].map(n => pickChannel(list, 'ada@example.com', day(n)).key));
    expect(seen.size).toBe(4);
  });

  it('spreads one day across everybody instead of all on one channel', () => {
    const counts = {};
    for (let i = 0; i < 400; i++) {
      const k = pickChannel(list, `user${i}@example.com`, day(0)).key;
      counts[k] = (counts[k] || 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['ig', 'tt', 'wa', 'x']);
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(60);
  });

  it('turns the day over at Lagos midnight, not UTC midnight', () => {
    // 23:30 UTC is already 00:30 the next day in Lagos.
    const before = pickChannel(list, 'ada@example.com', new Date(Date.UTC(2026, 9, 17, 22, 30)));
    const after = pickChannel(list, 'ada@example.com', new Date(Date.UTC(2026, 9, 17, 23, 30)));
    expect(after.key).not.toBe(before.key);
  });
});

describe('the shell', () => {
  it('leaves room for the card and the footer icons on ordinary mail', () => {
    const html = emailWrap({ body: '<p>hi</p>' });
    expect(html).toContain('{{CHANNEL_CARD}}');
    expect(html).toContain('{{SOCIAL_ROW}}');
  });

  it('keeps codes, resets and deletion notices clear of any channel', () => {
    const html = emailWrap({ body: '<p>reset</p>', noChannel: true });
    expect(html).not.toContain('{{CHANNEL_CARD}}');
    expect(html).not.toContain('{{SOCIAL_ROW}}');
  });

  it('leaves mail without the slots untouched', async () => {
    expect(await fillChannels('<p>plain</p>', 'ada@example.com')).toBe('<p>plain</p>');
  });
});
