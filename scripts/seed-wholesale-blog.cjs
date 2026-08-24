// The wholesale/reseller SEO post. Separate from seed-seo-blog so it can be
// re-run on its own; upserts by slug so editing the copy here and re-running
// updates the live post rather than duplicating it.
const SLUG = 'wholesale-smm-panel-nigeria-reseller-pricing';

const post = {
  slug: SLUG,
  title: 'Wholesale SMM Panel Pricing in Nigeria: How Reseller Rates Work',
  excerpt:
    'What wholesale SMM pricing actually means, who qualifies, how reseller rates compare to buying direct from a foreign provider, and how to get set up on Nitro.',
  category: 'Guides',
  authorName: 'Nitro Team',
  published: true,
  content: `Most people who find Nitro are buying for themselves — a few thousand followers, some views on a video, a boost before a launch. But a growing number are buying to sell again: panel owners, agencies managing a roster of clients, and people who quietly move six figures of orders a month for other people.

If that is you, you should not be paying retail. Here is how wholesale pricing works, who it is for, and what it actually changes.

## What wholesale pricing means

Retail pricing is what you see when you sign up. It covers the cost of the service, the support you get when something goes wrong, and the refill guarantees on our curated catalogue.

Wholesale pricing is a lower rate on the same services, given to accounts that resell. Nothing else changes: the same catalogue, the same wallet, the same order page, the same delivery. Only the price is different.

The margin between what you pay and what you charge your own customers is yours. That is the entire business model of reselling, and it only works if your buy price is low enough to leave room.

## Who it is for

Three kinds of buyer, and you probably recognise yourself in one of them.

**Panel owners.** You run your own SMM storefront under your own domain and brand. Your customers order from you, you order from a supplier. You need a supplier who settles in naira and does not disappear when something breaks.

**Agencies and account managers.** You are ordering for many different clients' accounts every week — different handles, different platforms, different budgets. You are not reselling in the formal sense, but you are buying volume and the margin matters.

**Bulk buyers.** No storefront, no clients, just serious monthly volume for your own portfolio of accounts. Wholesale is about volume, not about having a website.

## Why buy through a Nigerian panel at all

The obvious question: why not go straight to a foreign provider?

Some people do. But if you are operating from Nigeria, buying direct comes with friction that quietly eats the margin you thought you were saving.

**You need a dollar card that works.** Most Nigerian debit cards fail on international payment processors, or work until they suddenly do not. Virtual dollar cards get declined, funded at bad rates, or frozen without warning.

**You carry the FX risk.** Prices are quoted in dollars. Your customers pay you in naira. Between funding your balance and spending it, the rate moves — and it has not been moving in your favour.

**Minimums are set for a different market.** Foreign panels routinely require larger top-ups than a Nigerian reseller wants to hold in a foreign balance at any one time.

**Support runs on someone else's clock.** When an order stalls at 2am Lagos time and your customer is asking, you want someone who answers.

Buying wholesale through a Nigerian panel removes all four. You fund with Opay, PalmPay, Kuda or a bank transfer, in naira, at a price you can see, and you talk to people in your timezone.

## Curated versus full catalogue

This is the part most panels are vague about, so here is the honest version.

Our **curated catalogue** is the list we sell on the site. Every service on it has been tested and is covered by Nitro's own guarantees — refills where the tier promises them, and support when something goes wrong. It is smaller on purpose.

Our **full catalogue** is thousands of additional services from our suppliers. It is far bigger and often cheaper, and it carries each service's own terms rather than ours: whatever refill and cancellation the service itself offers, shown to you before you order, and nothing beyond that.

Both are available at wholesale rates. Which you use depends on whether you want breadth or want the guarantee. Most resellers use both — curated for the things their customers complain about, full catalogue for everything else.

## What wholesale does not include

Wholesale replaces retail incentives rather than stacking with them. Loyalty discounts and promo codes do not apply on top of a reseller rate — the reseller rate is already the deal, and it is better than any promotion we run.

That is worth saying plainly because some panels let discounts stack and then quietly claw it back elsewhere.

## Getting set up

There is no application form, and that is deliberate. A form is just a list of claims — anyone can tick a box saying they run a panel.

Instead, message our support on WhatsApp and tell us about your business in a couple of sentences: what you sell, roughly how much you move, and whether you run a panel or buy for clients. We will look at the account and switch wholesale pricing on.

Once it is on, nothing about how you order changes. Log in, place orders exactly as before, and the prices are simply lower. If you would rather automate, reseller accounts can also browse the full catalogue and order programmatically.

Start at [our reseller page](/resellers), or go straight to support and tell us what you do.

## A note on child panels

If you are weighing wholesale pricing against buying a child panel, they solve different problems. A child panel gives you a storefront. Wholesale pricing gives you a better buy price. You can have one without the other, and plenty of resellers do fine with just the second.

We wrote about that trade-off in detail: [What Is a Child Panel? And Should You Buy One?](/blog/what-is-a-child-panel-smm)`,
};

async function main({ prisma, dryRun, logger }) {
  const existing = await prisma.blogPost.findUnique({ where: { slug: SLUG } });
  logger.log(`${existing ? 'updating' : 'creating'} ${SLUG} (${post.content.length} chars)`);
  if (dryRun) return { dryRun, action: existing ? 'update' : 'create', slug: SLUG };
  const saved = await prisma.blogPost.upsert({
    where: { slug: SLUG },
    create: post,
    update: { title: post.title, excerpt: post.excerpt, content: post.content, category: post.category, published: post.published },
  });
  logger.log(`saved: /blog/${saved.slug}`);
  return { id: saved.id, slug: saved.slug };
}

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const dryRun = process.env.BLOG_APPLY !== 'yes';
  console.log(`[seed-wholesale-blog] ${dryRun ? 'DRY-RUN (set BLOG_APPLY=yes to write)' : 'APPLY'}`);
  main({ prisma, dryRun, logger: console })
    .then(r => { console.log(JSON.stringify(r)); return prisma.$disconnect(); })
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}

module.exports = { SLUG, post, main };
