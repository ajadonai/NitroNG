import { describe, expect, it } from 'vitest';
import { linkifyPlatformMentions } from '@/lib/blog-internal-links';

describe('linkifyPlatformMentions', () => {
  it('links a bare platform mention to its service page', () => {
    const out = linkifyPlatformMentions('<p>Try Spotify for your next release.</p>');
    expect(out).toContain('<a href="/services/spotify">Spotify</a>');
  });

  it('prefers the specific type page over the platform hub', () => {
    const out = linkifyPlatformMentions('<p>Buy TikTok Views before the trend dies.</p>');
    expect(out).toContain('<a href="/services/tiktok/views">TikTok Views</a>');
    // The bare word "TikTok" is the substring of the phrase just linked, so it
    // must not also be wrapped a second time inside that same anchor text.
    expect(out.match(/<a /g).length).toBe(1);
  });

  it('never touches text already inside a link', () => {
    const html = '<p>Read our <a href="/blog/x">Instagram guide</a> first.</p>';
    expect(linkifyPlatformMentions(html)).toBe(html);
  });

  it('never touches text inside a heading', () => {
    const html = '<h2 id="sec-1">Why Instagram Matters</h2><p>ok</p>';
    const out = linkifyPlatformMentions(html);
    expect(out).toContain('<h2 id="sec-1">Why Instagram Matters</h2>');
    expect(out).not.toContain('<a href="/services/instagram">Instagram</a></h2>');
  });

  it('links only the first mention of a platform, not every one', () => {
    const out = linkifyPlatformMentions('<p>Instagram. Instagram. Instagram.</p>');
    expect(out.match(/<a /g).length).toBe(1);
  });

  it('links different platforms independently in the same post', () => {
    const out = linkifyPlatformMentions('<p>Compare Audiomack and Boomplay for a Nigerian release.</p>');
    expect(out).toContain('<a href="/services/audiomack">Audiomack</a>');
    expect(out).toContain('<a href="/services/boomplay">Boomplay</a>');
  });

  it('caps the total number of links inserted into one post', () => {
    const platforms = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Telegram', 'Spotify'];
    const html = `<p>${platforms.join('. ')}.</p>`;
    const out = linkifyPlatformMentions(html);
    expect(out.match(/<a /g).length).toBeLessThanOrEqual(4);
  });

  it('does not link to the URL of the page already being rendered', () => {
    const out = linkifyPlatformMentions('<p>More Instagram tips inside.</p>', { currentUrl: '/services/instagram' });
    expect(out).not.toContain('<a href="/services/instagram">');
  });

  it('does not link a second time to a URL an existing hand-written link already points at', () => {
    // A real post had exactly this shape: a bare "Spotify" mention early on,
    // and a hand-written link to the same page later. Only the hand-written
    // one should survive.
    const html = '<p>Spotify is where most Nigerian streaming happens.</p>'
      + '<p>See our <a href="/services/spotify">Spotify services page</a> for pricing.</p>';
    const out = linkifyPlatformMentions(html);
    expect(out.match(/href="\/services\/spotify"/g).length).toBe(1);
    expect(out).toContain('<p>Spotify is where most Nigerian streaming happens.</p>');
  });

  it('does not touch content with no recognised platform names', () => {
    const html = '<p>Nothing to link here, just ordinary prose.</p>';
    expect(linkifyPlatformMentions(html)).toBe(html);
  });

  it('handles empty input', () => {
    expect(linkifyPlatformMentions('')).toBe('');
    expect(linkifyPlatformMentions(null)).toBe(null);
  });

  it('does not match "X" as a bare single letter inside ordinary words', () => {
    // The ambiguous single-letter brand name is deliberately excluded from the
    // term list — matching it would fire on ordinary text having nothing to do
    // with the platform.
    const out = linkifyPlatformMentions('<p>10x growth is not a typo here.</p>');
    expect(out).not.toContain('<a href="/services/x">');
  });
});
