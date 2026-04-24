export default async function sitemap() {
  const base = 'https://nitro.ng';

  const staticPages = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/audit`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refund`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cookie`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Fetch published blog posts for dynamic URLs
  let blogPages = [];
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    blogPages = posts.map(p => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch {}

  return [...staticPages, ...blogPages];
}
