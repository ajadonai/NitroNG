// Seed essential How To posts — Run: node prisma/seed-blog.cjs
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const POSTS = [
  {
    title: "How to Create Your Nitro Account",
    slug: "how-to-create-account",
    category: "Tutorials",
    excerpt: "Get started with Nitro in under 2 minutes. Here's how to sign up, verify your email, and log in.",
    sortOrder: 1,
    content: `
<h2>Step 1: Sign Up</h2>
<p>Head to <strong>nitro.ng</strong> and click <strong>"Get Started"</strong> or <strong>"Sign Up"</strong>. You'll need to provide:</p>
<ul>
  <li>Your <strong>first name</strong> and <strong>last name</strong></li>
  <li>A valid <strong>email address</strong></li>
  <li>A <strong>password</strong> (at least 6 characters)</li>
</ul>

<h2>Step 2: Verify Your Email</h2>
<p>After signing up, we'll send a <strong>6-digit verification code</strong> to your email. Enter the code on the verification screen to activate your account.</p>
<p><em>Didn't get the code?</em> Check your spam folder, or click <strong>"Resend Code"</strong> to get a new one.</p>

<h2>Step 3: Log In</h2>
<p>Once verified, log in with your email and password. You'll land on your <strong>dashboard</strong> where you can start placing orders right away.</p>

<h2>Tips</h2>
<ul>
  <li>Use a real email — you'll need it for password resets and order notifications</li>
  <li>Your password should be unique to Nitro for security</li>
</ul>
`.trim(),
  },
  {
    title: "How to Add Funds to Your Wallet",
    slug: "how-to-add-funds",
    category: "Tutorials",
    excerpt: "Fund your Nitro wallet using Paystack — card, bank transfer, or USSD. Takes seconds.",
    sortOrder: 2,
    content: `
<h2>Step 1: Go to Add Funds</h2>
<p>From your dashboard, click <strong>"Add Funds"</strong> in the left sidebar.</p>

<h2>Step 2: Enter Amount</h2>
<p>Type the amount you want to add in <strong>Naira (₦)</strong>. You can use the quick buttons (₦1,000 / ₦2,000 / ₦5,000 / ₦10,000) or type a custom amount.</p>

<h2>Step 3: Pay with Paystack</h2>
<p>Click <strong>"Fund Wallet"</strong>. You'll be redirected to Paystack's secure payment page where you can pay via:</p>
<ul>
  <li><strong>Card</strong> — Visa, Mastercard, Verve</li>
  <li><strong>Bank Transfer</strong> — pay to a generated account number</li>
  <li><strong>USSD</strong> — dial a code from your phone</li>
</ul>

<h2>Step 4: Confirmation</h2>
<p>Once payment is confirmed, your wallet balance updates <strong>instantly</strong>. You'll see the transaction in your recent activity.</p>

<h2>Tips</h2>
<ul>
  <li>Minimum deposit is <strong>₦500</strong></li>
  <li>Funds are added instantly after successful payment</li>
  <li>All payments are processed securely through Paystack</li>
</ul>
`.trim(),
  },
  {
    title: "How to Place Your First Order",
    slug: "how-to-place-order",
    category: "Tutorials",
    excerpt: "Step-by-step guide to placing your first social media order on Nitro. From selecting a platform to getting results.",
    sortOrder: 3,
    content: `
<h2>Step 1: Go to Services</h2>
<p>Click <strong>"Services"</strong> in your dashboard sidebar. You'll see all available platforms on the left.</p>

<h2>Step 2: Pick a Platform</h2>
<p>Click any platform (Instagram, TikTok, YouTube, etc.). The number badge shows how many services are available for each.</p>

<h2>Step 3: Select a Service</h2>
<p>Browse the service list and click the one you want (e.g., "Instagram Followers" or "TikTok Likes"). If the service has multiple tiers, you'll see tier cards expand — pick one.</p>

<h2>Step 4: Choose a Tier</h2>
<p>Each service comes in up to 3 quality tiers:</p>
<ul>
  <li><strong>💰 Budget</strong> — Cheapest option. Good for testing.</li>
  <li><strong>⚡ Standard</strong> — Best value. Stable with refill guarantee.</li>
  <li><strong>👑 Premium</strong> — Top quality. Non-drop with lifetime refill.</li>
</ul>
<p>Click a tier to select it. The order form will appear on the right sidebar (desktop) or as a bottom sheet (mobile).</p>

<h2>Step 5: Enter Details</h2>
<p>Paste your <strong>link</strong> (post URL, profile URL, etc.) and set your <strong>quantity</strong>. The total price updates automatically.</p>

<h2>Step 6: Place Order</h2>
<p>Click <strong>"Place Order"</strong>. The cost is deducted from your wallet balance and your order begins processing.</p>

<h2>Tips</h2>
<ul>
  <li>Make sure your profile/post is <strong>public</strong> — private accounts can't receive engagement</li>
  <li>Double-check your link before submitting</li>
  <li>Orders typically start within minutes, some within seconds</li>
</ul>
`.trim(),
  },
  {
    title: "Understanding Budget, Standard & Premium Tiers",
    slug: "understanding-tiers",
    category: "Guides",
    excerpt: "Not sure which tier to pick? Here's what each quality level means and when to use it.",
    sortOrder: 4,
    content: `
<h2>Three Tiers, Three Quality Levels</h2>
<p>Every service on Nitro comes in up to 3 tiers. Here's what sets them apart:</p>

<h3>💰 Budget Tier</h3>
<ul>
  <li><strong>Price:</strong> Cheapest available</li>
  <li><strong>Quality:</strong> Basic accounts, may have some drop</li>
  <li><strong>Refill:</strong> Usually none</li>
  <li><strong>Best for:</strong> Testing a service, boosting numbers quickly, non-critical posts</li>
</ul>

<h3>⚡ Standard Tier</h3>
<ul>
  <li><strong>Price:</strong> Mid-range</li>
  <li><strong>Quality:</strong> Better accounts, lower drop rate</li>
  <li><strong>Refill:</strong> 30-day refill guarantee on most services</li>
  <li><strong>Best for:</strong> Regular use, building consistent engagement, most users</li>
</ul>

<h3>👑 Premium Tier</h3>
<ul>
  <li><strong>Price:</strong> Highest</li>
  <li><strong>Quality:</strong> Top-quality accounts, minimal to no drop</li>
  <li><strong>Refill:</strong> Lifetime guarantee on most services</li>
  <li><strong>Best for:</strong> Important posts, client work, long-term growth, brand accounts</li>
</ul>

<h2>Which Should I Pick?</h2>
<p>If you're <strong>just starting out</strong> or testing, go with Budget. For <strong>everyday use</strong>, Standard gives you the best balance of price and quality. For <strong>important content</strong> or client work, Premium is worth it.</p>

<h2>What Does "Refill" Mean?</h2>
<p>If some followers or likes drop after delivery, we automatically refill them for free within the refill period (30 days or lifetime, depending on the tier).</p>
`.trim(),
  },
  {
    title: "How to Track Your Orders",
    slug: "how-to-track-orders",
    category: "Tutorials",
    excerpt: "Check order status, understand what each status means, and know when your order is complete.",
    sortOrder: 5,
    content: `
<h2>Viewing Your Orders</h2>
<p>Click <strong>"Orders"</strong> in your dashboard sidebar to see all your orders with their current status.</p>

<h2>Order Statuses</h2>
<ul>
  <li><strong>Pending</strong> — Your order has been placed and is waiting to start</li>
  <li><strong>Processing</strong> — Delivery is in progress. You should start seeing results.</li>
  <li><strong>Completed</strong> — Full quantity has been delivered</li>
  <li><strong>Partial</strong> — Only part of the order could be delivered. You'll be refunded for the undelivered portion.</li>
  <li><strong>Cancelled</strong> — The order was cancelled and your balance was refunded</li>
</ul>

<h2>How Long Do Orders Take?</h2>
<p>Delivery time depends on the service and tier:</p>
<ul>
  <li><strong>Views and impressions:</strong> Usually start within minutes</li>
  <li><strong>Likes and saves:</strong> Typically 1-12 hours</li>
  <li><strong>Followers:</strong> Can take 1-3 days for full delivery</li>
</ul>
<p>Each service listing shows an estimated speed (e.g., "5-10K/day").</p>

<h2>Tips</h2>
<ul>
  <li>Don't place multiple orders for the same link and service at the same time</li>
  <li>If an order seems stuck on "Pending" for more than 24 hours, contact support</li>
</ul>
`.trim(),
  },
  {
    title: "How to Use the Referral Program",
    slug: "referral-program",
    category: "Guides",
    excerpt: "Share your referral link, earn wallet credits when friends sign up and fund their accounts.",
    sortOrder: 6,
    content: `
<h2>How It Works</h2>
<p>Every Nitro user gets a unique <strong>referral link</strong>. When someone signs up using your link and makes their first deposit, you earn a <strong>wallet credit</strong>.</p>

<h2>Finding Your Referral Link</h2>
<p>Go to <strong>"Referrals"</strong> in your dashboard sidebar. Your unique link is displayed at the top — click to copy it.</p>

<h2>Sharing Your Link</h2>
<p>Share your referral link anywhere:</p>
<ul>
  <li>WhatsApp groups and status</li>
  <li>Twitter/X posts and DMs</li>
  <li>Instagram bio or stories</li>
  <li>YouTube descriptions</li>
  <li>Telegram channels</li>
</ul>

<h2>Earning Rewards</h2>
<p>When your referral signs up and funds their account, you'll receive a credit automatically. The more people you refer, the more you earn.</p>

<h2>Tips</h2>
<ul>
  <li>Focus on people who already use SMM services — they'll convert faster</li>
  <li>Share in communities where social media growth is discussed</li>
  <li>Your referral stats are tracked in real-time on the Referrals page</li>
</ul>
`.trim(),
  },
];

async function seed() {
  console.log('📝 Seeding essential How To blog posts...\n');

  for (const post of POSTS) {
    const existing = await p.blogPost.findUnique({ where: { slug: post.slug } });
    if (existing) {
      console.log(`   ⏭️  Skip: "${post.title}" (slug exists)`);
      continue;
    }

    await p.blogPost.create({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        published: true,
        showInHowTo: true,
        sortOrder: post.sortOrder,
        authorName: "Nitro Team",
      },
    });
    console.log(`   ✅ Created: "${post.title}"`);
  }

  const count = await p.blogPost.count();
  console.log(`\n🎉 Done! ${count} total blog posts in database.`);
}

seed().catch(e => { console.error('❌', e.message); }).finally(() => p.$disconnect());
