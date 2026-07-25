import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const postPatterns = {
  instagram: /\/(p|reel|reels|tv|stories)\//i,
  tiktok: /\/(video|photo|v)\//i,
  'twitter/x': /\/status\//i,
  youtube: /\/(watch|shorts|live)\b|youtu\.be\//i,
  facebook: /\/(posts|videos|watch|reel|photo|story)\b/i,
  threads: /\/post\//i,
};

const orders = await p.order.findMany({
  where: {
    status: { in: ['Cancelled', 'Partial'] },
    lastError: null,
    deletedAt: null,
  },
  include: {
    service: { select: { category: true } },
    tier: { select: { group: { select: { type: true } } } },
  },
});

console.log(`Found ${orders.length} cancelled/partial orders with no lastError\n`);

let updated = 0;
for (const order of orders) {
  const groupType = (order.tier?.group?.type || '').toLowerCase();
  const platform = (order.service?.category || '').toLowerCase();
  const link = (order.link || '').toLowerCase();
  const isUrl = /^https?:\/\//.test(link);

  const needsPost = ['likes', 'views', 'comments', 'engagement', 'plays'].includes(groupType);
  const needsProfile = groupType === 'followers';
  const platformMatch = Object.keys(postPatterns).some(p => platform.includes(p));
  const isPostLink = isUrl && Object.entries(postPatterns).some(([p, re]) => platform.includes(p) && re.test(link));

  let error = null;

  // Wrong platform entirely (e.g. nitro.ng link for an Instagram service)
  if (isUrl && platformMatch) {
    const platformDomains = {
      instagram: ['instagram.com'],
      tiktok: ['tiktok.com'],
      'twitter/x': ['x.com', 'twitter.com'],
      youtube: ['youtube.com', 'youtu.be'],
      facebook: ['facebook.com', 'fb.com', 'fb.watch'],
      threads: ['threads.net'],
    };
    const domains = Object.entries(platformDomains).find(([p]) => platform.includes(p))?.[1] || [];
    const matchesPlatform = domains.some(d => link.includes(d));
    if (!matchesPlatform) {
      error = 'wrong_platform_link';
    }
  }

  // Username (not a URL) for a service that needs a post link
  if (!error && !isUrl && needsPost) {
    error = 'needs_post_link';
  }

  // Profile link for a post service
  if (!error && needsPost && isUrl && platformMatch && !isPostLink) {
    error = 'needs_post_link';
  }

  // Post link for a follower service
  if (!error && needsProfile && isPostLink) {
    error = 'needs_profile_link';
  }

  if (error) {
    await p.order.update({ where: { id: order.id }, data: { lastError: error } });
    updated++;
    console.log(`${order.orderId || order.id}: ${error}  (link: ${order.link?.substring(0, 60)})`);
  }
}

console.log(`\nUpdated ${updated} of ${orders.length} orders`);
await p.$disconnect();
