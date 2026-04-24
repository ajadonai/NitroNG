# Infrastructure & Costs

> Monthly operating costs and service tiers for running Nitro. Review quarterly or when scaling.

---

## Service Overview

| Service | Purpose | Plan | Billing |
|---------|---------|------|---------|
| **Vercel** | Frontend hosting, serverless functions, CDN | Free / Pro | Monthly |
| **Neon** | PostgreSQL database | Free / Launch | Monthly |
| **Paystack** | Payment processing | Pay-per-transaction | Per transaction |
| **Brevo** | Transactional email | Free / Starter | Monthly |
| **MTP** | Primary SMM provider | Prepaid balance | Top-up as needed |
| **JAP** | Gap-filler SMM provider | Prepaid balance | Top-up as needed |
| **DaoSMM** | Nigerian specialist SMM provider | Prepaid balance | Top-up as needed |
| **GitHub** | Version control | Free | Free |
| **Domain (nitro.ng)** | Primary domain | Annual | Yearly |
| **Domain (thenitro.ng)** | Secondary domain | Annual | Yearly |

---

## Fixed Monthly Costs

### Vercel

| Tier | Cost | Limits | When to Upgrade |
|------|------|--------|-----------------|
| Hobby (Free) | $0/mo | 100GB bandwidth, 10s function timeout, 1 deploy/commit | Fine for launch |
| Pro | $20/mo | 1TB bandwidth, 60s function timeout, preview deploys, team access | When you hit bandwidth limits or need longer function execution |

**Current:** Likely on Free/Hobby. Monitor bandwidth usage — if you're serving lots of static assets or get traffic spikes, you'll need Pro.

### Neon (PostgreSQL)

| Tier | Cost | Limits | When to Upgrade |
|------|------|--------|-----------------|
| Free | $0/mo | 0.5 GB storage, 1 project, auto-suspend after 5 min inactivity | Fine for launch |
| Launch | $19/mo | 10 GB storage, no auto-suspend, point-in-time recovery | When cold starts annoy users or storage fills up |
| Scale | $69/mo | 50 GB storage, autoscaling, read replicas | When you need serious throughput |

**Current:** Likely Free tier. The auto-suspend cold start (first request after inactivity takes 1-3 seconds) is the main pain point. Upgrade to Launch once revenue justifies it.

### Brevo (Email)

| Tier | Cost | Limits | When to Upgrade |
|------|------|--------|-----------------|
| Free | $0/mo | 300 emails/day | Fine for early launch |
| Starter | $9/mo | 5,000 emails/month, no daily limit | When daily signups + orders exceed 300 emails |
| Business | $18/mo | 5,000 emails/month, advanced stats, A/B testing | When you need deliverability insights |

**Current:** Likely Free. At 300/day, you can handle ~100 active users (each generating ~3 emails: order placed, completed, wallet funded). Upgrade when growth pushes past this.

---

## Variable Costs

### Paystack (Transaction Fees)

| Fee Type | Rate | Notes |
|----------|------|-------|
| Local card transactions | 1.5% + ₦100 | Capped at ₦2,000 per transaction |
| Bank transfer | ₦50 flat | Best rate for larger deposits |
| USSD | 1.5% + ₦100 | Capped at ₦2,000 |

**Note:** Paystack deducts fees from the transaction before settlement. If a user deposits ₦10,000 via card, Paystack takes ~₦250, and ₦9,750 settles to your account. But the user's wallet should be credited the full ₦10,000 (Nitro absorbs the fee). Make sure the crediting logic uses the original amount, not the settled amount.

### SMM Provider Balances

These are prepaid — you deposit funds and orders draw from the balance.

| Provider | Currency | Recommended Min Balance | Top-Up Threshold |
|----------|----------|------------------------|-----------------|
| MTP | USD | $100 | Top up when below $50 |
| JAP | USD | $50 | Top up when below $25 |
| DaoSMM | NGN/USD | ₦50,000 / $50 | Top up when below half |

**Cost flow:** User pays ₦ → Nitro keeps the margin → Nitro pays provider in USD (or NGN for DaoSMM). The markup brackets (3.5× down to 1.35×) ensure margin covers Paystack fees + provider cost + profit.

---

## Annual Costs

| Item | Estimated Cost | Notes |
|------|---------------|-------|
| nitro.ng domain | ~₦15,000–25,000/yr | .ng domains via NiRA-accredited registrars |
| thenitro.ng domain | ~₦15,000–25,000/yr | Secondary domain |
| Google Workspace (if used) | ~$72/yr ($6/mo) | For admin@thenitro.ng email |

---

## Cost Projections by Scale

### Launch (0–500 users)

| Item | Monthly Cost |
|------|-------------|
| Vercel | $0 (Free) |
| Neon | $0 (Free) |
| Brevo | $0 (Free) |
| Paystack fees | Variable (~₦5,000–20,000) |
| Provider deposits | Variable (~$50–200) |
| **Total fixed** | **$0/mo** |
| **Total variable** | **~₦30,000–100,000/mo** |

### Growth (500–5,000 users)

| Item | Monthly Cost |
|------|-------------|
| Vercel | $20 (Pro) |
| Neon | $19 (Launch) |
| Brevo | $9 (Starter) |
| Paystack fees | Variable (~₦50,000–200,000) |
| Provider deposits | Variable (~$200–1,000) |
| **Total fixed** | **~$48/mo (~₦75,000)** |
| **Total variable** | **~₦200,000–800,000/mo** |

### Scale (5,000+ users)

| Item | Monthly Cost |
|------|-------------|
| Vercel | $20+ (Pro) |
| Neon | $69 (Scale) |
| Brevo | $18+ (Business) |
| Railway (workers) | ~$5–20 |
| Paystack fees | Variable |
| Provider deposits | Variable |
| **Total fixed** | **~$130/mo (~₦200,000)** |

---

## Monitoring Costs

Track these monthly:

- **Vercel dashboard** → Usage tab (bandwidth, function invocations)
- **Neon dashboard** → Storage, compute hours, connections
- **Brevo dashboard** → Emails sent vs limit
- **Paystack dashboard** → Transaction volume, fees collected
- **Provider dashboards** → Balance burn rate

---

## When to Scale What

| Signal | Action |
|--------|--------|
| Neon cold starts annoying users | Upgrade to Launch ($19/mo) |
| Hitting 300 emails/day | Upgrade Brevo to Starter ($9/mo) |
| Vercel bandwidth warnings | Upgrade to Pro ($20/mo) |
| Order polling too slow | Add Railway worker for background jobs |
| Provider balance hitting zero | Increase top-up amounts, set up alerts |
| Paystack fees eating margins | Consider bank transfer incentives (₦50 flat vs 1.5%) |
