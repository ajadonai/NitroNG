# Service Catalogue

---

## Structure

```
Platform (e.g., Instagram)
  └── ServiceGroup (user-facing name)
        ├── Budget Tier   → provider service ID, markup price
        ├── Standard Tier → provider service ID, markup price
        └── Premium Tier  → provider service ID, markup price
```

- **Platform** — The social media platform (Instagram, TikTok, YouTube, etc.)
- **ServiceGroup** — What the user sees. e.g., "Instagram Followers", "Instagram Followers — Nigeria Targeted"
- **ServiceTier** — Quality/price level within a group. Maps 1:1 to a provider service ID.

---

## Scale

| Metric | Count |
|--------|-------|
| Platforms | 29 |
| Service Groups | 185 |
| Total Tiers | 278 |
| Nigerian-specific Groups | 38 |
| Nigerian-specific Tiers | 60 |

### Tier Distribution

- **High-demand services** (Instagram followers, TikTok views, YouTube subs) → 3 tiers
- **Mid-demand services** (LinkedIn, Telegram, Threads) → 2 tiers
- **Niche services** (Audiomack, Boomplay, reviews) → 1 tier (Standard)

---

## Pricing

### Markup Brackets

Applied over provider cost (in ₦):

| Provider Cost (₦) | Multiplier | Example: ₦10 cost → ₦35 price |
|-------------------|-----------|------|
| ₦0 – ₦20 | 3.5× | Low-cost services get highest markup |
| ₦20 – ₦200 | 2.5× | |
| ₦200 – ₦1,000 | 2× | |
| ₦1,000 – ₦5,000 | 1.7× | |
| ₦5,000 – ₦20,000 | 1.5× | |
| ₦20,000+ | 1.35× | High-cost services get lowest markup |

### Margin Floor

**Minimum 50% margin** enforced automatically. If a bracket calculation results in less than 50% margin, the system bumps the price up.

### Positioning

Nitro is **premium** — not competing on price with budget panels like Owlet (50–80% below market). Budget tier pricing is set adjacent to Owlet where margins allow. Standard and Premium are priced above market.

---

## Minimum Orders

| Service Type | Minimum Quantity |
|-------------|-----------------|
| Followers | 100 |
| Likes | 50 |
| Views | 500 |
| Comments | 10 |
| Engagement | 50 |
| Subscribers | 100 |

---

## Tier Definitions

### Budget (Amber)

Most affordable option. Delivery may be slower, retention may be lower. Accounts used for delivery are typically lower quality. Best for number boosting or testing.

### Standard (Blue)

Balanced quality and price. Good delivery speed, reasonable retention. The default recommendation for most users.

### Premium (Purple)

Highest quality. Faster delivery, higher retention, better-quality accounts. Best for business pages, influencer accounts, brand launches where credibility matters.

### Nigerian Services (Green + 🇳🇬)

Services specifically targeting Nigerian audiences. Sourced through DaoSMM (Nigerian specialist) or geo-filtered services from MTP/JAP. Flagged visually on the services page.

---

## Provider Mapping

Each tier's `providerServiceId` connects it to a specific upstream service:

| Nitro Tier | Provider | Provider Service ID |
|-----------|----------|-------------------|
| IG Followers — Budget | MTP | (mapped during seeding) |
| IG Followers — Standard | MTP | (mapped during seeding) |
| IG Followers — Premium | MTP | (mapped during seeding) |
| Audiomack Plays — Standard | JAP | (mapped during seeding) |
| IG Followers NG — Standard | DaoSMM | (mapped during seeding) |

Provider service IDs occasionally change when providers restructure. Verify mappings by querying the provider's `action=services` endpoint.

---

## Platforms Supported

Instagram, TikTok, YouTube, Twitter/X, Facebook, Spotify, Telegram, LinkedIn, Snapchat, Threads, Pinterest, Reddit, Twitch, Discord, SoundCloud, Audiomack, Boomplay, Apple Music, WhatsApp, Clubhouse, Likee, Kwai, ShareChat, Rumble, Dailymotion, VK, OK.ru, Periscope, and web traffic/review services.

---

## Adding New Services

1. Query the provider API (`action=services`) for available services
2. Identify the service ID, rate, min/max, refill/cancel capabilities
3. Create a ServiceGroup in the admin panel (or map to existing)
4. Create the ServiceTier with the provider service ID
5. Apply pricing bracket based on provider cost in ₦
6. Verify the margin meets the 50% floor
7. Test with a small order before enabling for users

---

## Admin Management

- **Superadmins** can add/edit ServiceGroups, modify pricing brackets, and create tiers
- **Admins** can toggle tier availability and update provider service ID mappings
- Pricing brackets are editable in the admin panel under Settings
