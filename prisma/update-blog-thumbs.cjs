const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const thumbs = {
  "how-to-place-your-first-order": "/blog/how-to-place-your-first-order.svg",
  "how-to-add-funds": "/blog/how-to-add-funds.svg",
  "understanding-tiers": "/blog/understanding-tiers.svg",
  "referral-program": "/blog/referral-program.svg",
  "order-status-guide": "/blog/order-status-guide.svg",
  "5-tips-nitro": "/blog/5-tips-nitro.svg",
};

async function run() {
  for (const [slug, thumbnail] of Object.entries(thumbs)) {
    const post = await p.blogPost.findFirst({ where: { slug } });
    if (post) {
      await p.blogPost.update({ where: { id: post.id }, data: { thumbnail } });
      console.log(`  ✅ ${slug} → ${thumbnail}`);
    } else {
      console.log(`  ⚠️  ${slug} not found`);
    }
  }
  console.log('\nDone!');
}

run().catch(e => console.error('ERROR:', e.message)).finally(() => p.$disconnect());
