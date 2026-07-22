import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DATES = {
  'how-to-grow-instagram-account-nigeria': '2026-03-05T09:00:00Z',
  'is-buying-social-media-followers-safe': '2026-03-12T11:30:00Z',
  'how-to-place-your-first-order': '2026-03-18T10:00:00Z',
  'how-to-add-funds': '2026-03-22T14:00:00Z',
  'order-status-guide': '2026-03-28T09:30:00Z',
  'understanding-tiers': '2026-04-02T12:00:00Z',
  'referral-program': '2026-04-08T10:00:00Z',
  '5-tips-nitro': '2026-04-14T11:00:00Z',
  'buy-instagram-followers-nigeria-guide': '2026-04-20T09:00:00Z',
  'best-smm-panel-nigeria': '2026-04-25T13:00:00Z',
  'how-to-get-tiktok-views-followers': '2026-05-01T10:30:00Z',
  'how-to-buy-youtube-subscribers-nigeria': '2026-05-07T14:00:00Z',
};

async function run() {
  const posts = await prisma.blogPost.findMany({ select: { id: true, slug: true, title: true } });

  for (const post of posts) {
    const date = DATES[post.slug];
    if (date) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { createdAt: new Date(date) },
      });
      console.log(`  ${post.slug} → ${date.slice(0, 10)}`);
    } else {
      console.log(`  ${post.slug} — no date mapping, skipped`);
    }
  }

  console.log('\nDone.');
}

run().catch(e => console.error(e)).finally(() => prisma.$disconnect());
