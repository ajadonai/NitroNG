import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLATFORM_SLUGS, PLATFORM_PAGE_SLUGS } from '../lib/platform-pages.js';

const pageSrc = readFileSync(new URL('../app/services/[platform]/page.jsx', import.meta.url), 'utf8');
const sitemapSrc = readFileSync(new URL('../app/sitemap.js', import.meta.url), 'utf8');

const metaSlugs = [...pageSrc.match(/const PLATFORM_META = \{([\s\S]*?)\n\};/)[1]
  .matchAll(/^ {2}([a-z0-9]+):\s*\{/gm)].map(m => m[1]);
const orderSlugs = JSON.parse(
  pageSrc.match(/const PLATFORM_ORDER = (\[[^\]]*\])/)[1].replace(/'/g, '"'),
);

/**
 * The slug list was written twice — once in the sitemap, once on the page —
 * with nothing tying them together, and they drifted. Spotify had a finished
 * page with eleven live groups behind it and no sitemap entry, so it was never
 * crawled. These run in both directions because each direction fails
 * differently: a slug the sitemap omits is a page nobody finds, and a slug the
 * page omits is a sitemap entry that 404s.
 */
describe('platform pages and the sitemap agree', () => {
  it('lists every page slug in the sitemap', () => {
    const missing = metaSlugs.filter(s => !PLATFORM_PAGE_SLUGS.includes(s));
    expect(missing, `pages Google is never told about: ${missing.join(', ')}`).toEqual([]);
  });

  it('has a page for every slug the sitemap promises', () => {
    const missing = PLATFORM_PAGE_SLUGS.filter(s => !metaSlugs.includes(s));
    expect(missing, `sitemap entries that would 404: ${missing.join(', ')}`).toEqual([]);
  });

  it('pre-renders every slug it lists', () => {
    // generateStaticParams walks PLATFORM_ORDER, so a slug missing from it is
    // rendered on demand rather than at build — crawlable, but slower first.
    const missing = PLATFORM_PAGE_SLUGS.filter(s => !orderSlugs.includes(s));
    expect(missing, `not pre-rendered: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps both casings of TikTok, because live groups carry both', () => {
    expect(PLATFORM_SLUGS.TikTok).toBe('tiktok');
    expect(PLATFORM_SLUGS.tiktok).toBe('tiktok');
  });

  it('reads the map from one module rather than redeclaring it', () => {
    expect(sitemapSrc).toContain("import { PLATFORM_SLUGS } from '@/lib/platform-pages'");
    expect(sitemapSrc).not.toMatch(/const PLATFORM_SLUGS = \{/);
  });
});
