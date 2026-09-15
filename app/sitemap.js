import { PLATFORM_SLUGS } from '@/lib/platform-pages';

export default async function sitemap() {
  const base = 'https://nitro.ng';

  // The landing page in the languages that have their own URL. They carry the
  // same priority as the English one because they are the same page, not a
  // lesser version of it — and alternates/hreflang on each page is what ties
  // the four together. Only the landing page is listed: a locale URL is added
  // here when that page is genuinely translated, never before, because a
  // French URL serving English is duplicate content in the wrong language.
  const localeHome = ['fr', 'sw', 'ar'].map((code) => ({
    url: `${base}/${code}`, lastModified: '2026-09-09', changeFrequency: 'weekly', priority: 1.0,
  }));

  const staticPages = [
    { url: base, lastModified: '2025-01-01', changeFrequency: 'weekly', priority: 1.0 },
    ...localeHome,
    { url: `${base}/blog`, lastModified: '2025-01-01', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified: '2025-01-01', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/services`, lastModified: '2025-07-01', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/quality`, lastModified: '2025-06-15', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/contact`, lastModified: '2025-06-15', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/pit`, lastModified: '2025-06-15', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/resellers`, lastModified: '2026-08-24', changeFrequency: 'monthly', priority: 0.7 },
    // Public pages that were never listed. /resellers/docs sets robots index
    // true and its own canonical, so it was always meant to be found; /audit is
    // a free tool, which is the kind of page other sites link to unprompted;
    // /changelog changes weekly and is the only page here that proves the site
    // is alive. /live is still missing on purpose — it exports no metadata at
    // all, and listing an untitled page spends crawl budget to rank nothing.
    { url: `${base}/resellers/docs`, lastModified: '2026-08-24', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/audit`, lastModified: '2026-09-09', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/changelog`, lastModified: '2026-09-09', changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/lagos`, lastModified: '2025-06-15', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/reviews`, lastModified: '2025-07-01', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/help`, lastModified: '2025-06-15', changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about`, lastModified: '2025-01-01', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/faq`, lastModified: '2025-01-01', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/terms`, lastModified: '2025-01-01', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: '2025-01-01', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refund`, lastModified: '2025-01-01', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cookie`, lastModified: '2025-01-01', changeFrequency: 'yearly', priority: 0.2 },
  ];

  let blogPages = [];
  let servicePages = [];

  try {
    const prisma = (await import('@/lib/prisma')).default;
    const SERVICE_TYPE_META = (await import('@/lib/service-type-meta')).default;
    const BLOG_CATEGORIES = (await import('@/lib/blog-categories')).default;

    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, category: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    blogPages = posts.map(p => ({
      url: `${base}/${p.category === 'Help' ? 'help' : 'blog'}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly',
      priority: p.category === 'Help' ? 0.4 : 0.6,
    }));

    const nonHelpPosts = posts.filter(p => p.category !== 'Help');
    for (const [key, cat] of Object.entries(BLOG_CATEGORIES)) {
      const matching = nonHelpPosts.filter(p => cat.match(p.slug));
      if (matching.length) {
        blogPages.push({
          url: `${base}/blog/${key}`,
          lastModified: matching[0].updatedAt,
          changeFrequency: 'weekly',
          priority: 0.55,
        });
      }
    }

    const groups = await prisma.serviceGroup.findMany({
      where: { enabled: true },
      select: { platform: true, updatedAt: true },
    });
    const platformDates = {};
    const slugs = new Set();
    for (const g of groups) {
      const slug = PLATFORM_SLUGS[g.platform];
      if (!slug) continue;
      if (!platformDates[slug] || g.updatedAt > platformDates[slug]) {
        platformDates[slug] = g.updatedAt;
      }
      slugs.add(slug);
    }
    for (const slug of slugs) {
      servicePages.push({
        url: `${base}/services/${slug}`,
        lastModified: platformDates[slug],
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }

    for (const [key, meta] of Object.entries(SERVICE_TYPE_META)) {
      if (!meta.h1 || !slugs.has(meta.platform)) continue;
      servicePages.push({
        url: `${base}/services/${key}`,
        lastModified: platformDates[meta.platform] || '2025-01-01',
        changeFrequency: 'weekly',
        priority: 0.65,
      });
    }
  } catch {}

  return [...staticPages, ...blogPages, ...servicePages];
}
