// Nitro Blog Seed — Run: node prisma/seed-blog.cjs
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const POSTS = [
  {
    title: "How to Place Your First Order on Nitro",
    slug: "how-to-place-your-first-order",
    thumbnail: "/blog/how-to-place-your-first-order.svg",
    excerpt: "A step-by-step guide to placing your first social media order on Nitro. From picking a platform to watching your numbers grow.",
    category: "Tutorials",
    showInHowTo: true,
    sortOrder: 1,
    content: `
<h2>Getting Started</h2>
<p>Placing an order on Nitro takes less than 60 seconds. Here's how:</p>

<h3>Step 1 — Go to Services</h3>
<p>Click <strong>Services</strong> in your dashboard sidebar. You'll see a list of platforms on the left — Instagram, TikTok, YouTube, Twitter/X, and {{platform_count}}+ more.</p>

<h3>Step 2 — Pick a Platform</h3>
<p>Click any platform to see available services. Each platform shows a count badge so you know how many services are available before clicking.</p>

<h3>Step 3 — Choose a Service</h3>
<p>Browse the service list and click the one you want. If it has multiple tiers (Budget, Standard, Premium), you'll see tier cards expand below — click the tier you want.</p>

<h3>Step 4 — Fill the Order Form</h3>
<p>The order form appears on the right sidebar (desktop) or as a bottom sheet (mobile). Enter:</p>
<ul>
  <li><strong>Link</strong> — the URL of the post, profile, or video you want to boost</li>
  <li><strong>Quantity</strong> — how many followers, likes, views, etc. you want</li>
</ul>

<h3>Step 5 — Place Order</h3>
<p>Review the total price, then click <strong>Place Order</strong>. The amount is deducted from your wallet balance. Your order starts processing immediately.</p>

<h3>Tips</h3>
<ul>
  <li>Make sure your profile/post is set to <strong>public</strong> before ordering</li>
  <li>Double-check the link — wrong links can't be refunded</li>
  <li>Start with a smaller quantity to test, then scale up</li>
</ul>`,
  },
  {
    title: "How to Add Funds to Your Nitro Wallet",
    slug: "how-to-add-funds",
    thumbnail: "/blog/how-to-add-funds.svg",
    excerpt: "Fund your Nitro wallet using Flutterwave — cards, bank transfer, and USSD all supported. Takes less than a minute.",
    category: "Tutorials",
    showInHowTo: true,
    sortOrder: 2,
    content: `
<h2>Funding Your Wallet</h2>
<p>You need a funded wallet to place orders. Here's how to add money:</p>

<h3>Step 1 — Go to Add Funds</h3>
<p>Click <strong>Add Funds</strong> in your dashboard sidebar.</p>

<h3>Step 2 — Enter Amount</h3>
<p>Type the amount you want to add in Naira (₦). You can use the quick-select buttons (₦1,000 / ₦2,500 / ₦5,000 / ₦10,000) or enter a custom amount.</p>

<h3>Step 3 — Pay with Flutterwave</h3>
<p>Click <strong>Fund Wallet</strong>. You'll be redirected to Flutterwave's secure checkout where you can pay with:</p>
<ul>
  <li>Debit/Credit card (Visa, Mastercard, Verve)</li>
  <li>Bank transfer</li>
  <li>USSD</li>
</ul>

<h3>Step 4 — Confirmation</h3>
<p>Once payment is confirmed, your wallet balance updates instantly. You'll see the transaction in your <strong>Orders</strong> page under the Transactions tab.</p>

<h3>Good to Know</h3>
<ul>
  <li>Minimum deposit: {{min_deposit}}</li>
  <li>No maximum limit</li>
  <li>Funds are added instantly after payment confirmation</li>
  <li>All transactions are recorded in your dashboard</li>
</ul>`,
  },
  {
    title: "Understanding Budget, Standard & Premium Tiers",
    slug: "understanding-tiers",
    thumbnail: "/blog/service-tiers.svg",
    excerpt: "Not sure which tier to pick? Here's what Budget, Standard, and Premium mean for your order quality, speed, and refill guarantee.",
    category: "Tutorials",
    showInHowTo: true,
    sortOrder: 3,
    content: `
<h2>What Are Tiers?</h2>
<p>Most services on Nitro come in up to 3 quality tiers. Each tier offers a different balance of price, quality, and guarantee.</p>

<h3>💰 Budget</h3>
<p>The cheapest option. Best for testing or when you just need numbers fast.</p>
<ul>
  <li><strong>Price:</strong> Lowest</li>
  <li><strong>Quality:</strong> May include some drops over time</li>
  <li><strong>Refill:</strong> Usually no refill guarantee</li>
  <li><strong>Speed:</strong> Often the fastest delivery</li>
  <li><strong>Best for:</strong> Testing a service, boosting numbers quickly, non-critical accounts</li>
</ul>

<h3>⚡ Standard</h3>
<p>The sweet spot. Good quality at a fair price with refill protection.</p>
<ul>
  <li><strong>Price:</strong> Mid-range</li>
  <li><strong>Quality:</strong> Stable with low drop rates</li>
  <li><strong>Refill:</strong> 30-day refill guarantee (if any drop, we top up for free)</li>
  <li><strong>Speed:</strong> Moderate, natural-looking delivery</li>
  <li><strong>Best for:</strong> Most users, business accounts, consistent growth</li>
</ul>

<h3>👑 Premium</h3>
<p>Top-tier quality. Highest retention, lifetime guarantee, real-looking accounts.</p>
<ul>
  <li><strong>Price:</strong> Highest</li>
  <li><strong>Quality:</strong> Non-drop or minimal drop, high-quality accounts</li>
  <li><strong>Refill:</strong> Lifetime refill guarantee</li>
  <li><strong>Speed:</strong> Natural delivery speed</li>
  <li><strong>Best for:</strong> Brand accounts, influencers, when quality matters most</li>
</ul>

<h3>Which Should I Choose?</h3>
<p>If you're new, start with <strong>Standard</strong> — it's the best value. Use Budget for testing, and Premium when you need guaranteed results on important accounts.</p>`,
  },
  {
    title: "How the Nitro Referral Program Works",
    slug: "referral-program",
    thumbnail: "/blog/referral-program.svg",
    excerpt: "Invite friends to Nitro and earn rewards. Here's how the referral system works and how to maximize your earnings.",
    category: "Guides",
    showInHowTo: true,
    sortOrder: 4,
    content: `
<h2>Earn by Sharing Nitro</h2>
<p>Every Nitro user gets a unique referral link. When someone signs up using your link and makes their first deposit, you both get rewarded.</p>

<h3>How It Works</h3>
<ol>
  <li>Go to <strong>Referrals</strong> in your dashboard</li>
  <li>Copy your unique referral link</li>
  <li>Share it with friends, on social media, or in your community</li>
  <li>When someone signs up and funds their wallet, you both earn a bonus</li>
</ol>

<h3>What You Earn</h3>
<ul>
  <li><strong>You (referrer):</strong> {{referrer_bonus}} credited to your wallet</li>
  <li><strong>Your friend (invitee):</strong> {{invitee_bonus}} bonus on signup</li>
  <li>No limit on how many people you can refer</li>
  <li>Track all your referrals and earnings in the Referrals dashboard</li>
</ul>

<h3>Tips for More Referrals</h3>
<ul>
  <li>Share your link in WhatsApp groups and Telegram channels</li>
  <li>Post about Nitro on your social media with your link</li>
  <li>Recommend Nitro to fellow content creators and marketers</li>
</ul>`,
  },
  {
    title: "Order Status Guide — What Each Status Means",
    slug: "order-status-guide",
    thumbnail: "/blog/order-status-guide.svg",
    excerpt: "Your order shows Processing, Completed, or Partial? Here's what each status means and what to do.",
    category: "Tutorials",
    showInHowTo: true,
    sortOrder: 5,
    content: `
<h2>Understanding Order Statuses</h2>
<p>After placing an order, you can track its progress in the <strong>Orders</strong> section of your dashboard.</p>

<h3>Pending</h3>
<p>Your order has been received and is queued for processing. This usually lasts a few seconds to a few minutes.</p>

<h3>Processing / In Progress</h3>
<p>Your order is actively being fulfilled. Delivery speed depends on the service and tier you selected. Some services deliver gradually over hours or days for a natural look.</p>

<h3>Completed</h3>
<p>Full quantity has been delivered. If you have a refill guarantee and notice drops later, contact support.</p>

<h3>Partial</h3>
<p>Only part of the quantity was delivered. The remaining undelivered portion is refunded to your wallet automatically.</p>

<h3>Cancelled</h3>
<p>The order was cancelled and your funds were returned to your wallet.</p>

<h3>What If My Order Is Stuck?</h3>
<ul>
  <li>Most orders complete within the estimated delivery time shown on the service</li>
  <li>If an order has been processing for over 24 hours, check that your link is correct and your profile is public</li>
  <li>Contact <strong>Support</strong> from your dashboard if the issue persists</li>
</ul>`,
  },
  {
    title: "5 Tips to Get the Most Out of Nitro",
    slug: "5-tips-nitro",
    thumbnail: "/blog/5-tips-nitro.svg",
    excerpt: "Practical tips for Nigerian creators and businesses to maximize their social media growth with Nitro.",
    category: "Tips & Tricks",
    showInHowTo: true,
    sortOrder: 6,
    content: `
<h2>Maximize Your Growth</h2>
<p>Nitro helps you boost your numbers, but combining it with good strategy gets you the best results.</p>

<h3>1. Start Small, Then Scale</h3>
<p>Don't dump 50K followers on a brand-new account. Start with a smaller order, see the quality, then increase gradually. This also looks more natural to algorithms.</p>

<h3>2. Match Content Quality with Boosts</h3>
<p>Boosted numbers get attention, but people stay for good content. Make sure your posts, reels, and videos are high quality before boosting engagement.</p>

<h3>3. Use the Right Tier for the Right Job</h3>
<p>Testing a new platform? Use <strong>Budget</strong>. Running your main business account? Go <strong>Standard</strong> or <strong>Premium</strong>. Don't overspend on testing, don't underspend on your brand.</p>

<h3>4. Spread Orders Over Time</h3>
<p>Instead of ordering 10K followers in one shot, consider splitting into 2-3 smaller orders over a few days. This creates more natural-looking growth.</p>

<h3>5. Combine Services</h3>
<p>Don't just buy followers — pair them with likes, views, and engagement on your posts. A profile with 10K followers but 5 likes per post looks suspicious. Balance your numbers.</p>`,
  },
];

async function seed() {
  console.log('📝 Seeding blog posts...\n');

  const existing = await p.blogPost.count();
  if (existing > 0) {
    await p.blogPost.deleteMany();
    console.log(`🗑️  Cleared ${existing} existing posts\n`);
  }

  for (const post of POSTS) {
    await p.blogPost.create({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content.trim(),
        category: post.category,
        thumbnail: post.thumbnail,
        published: true,
        showInHowTo: post.showInHowTo,
        sortOrder: post.sortOrder,
        authorName: "Nitro Team",
      },
    });
    console.log(`  ✅ ${post.title}`);
  }

  console.log(`\n🎉 Done! ${POSTS.length} posts created and published.`);
}

seed()
  .catch(e => { console.error('❌', e.message); })
  .finally(() => p.$disconnect());
