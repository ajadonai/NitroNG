# Deleted curated tiers — reference

Removed 2026-09-16 02:58 UTC: **31 disabled tiers** that sat inside
enabled groups. Groups were left alone. Nothing customer-facing changed —
every one of them was already switched off.

## What survived

- **Orders keep everything.** All 1,869 carry `platformAtPurchase`,
  `serviceNameAtPurchase` and `tierNameAtPurchase`, so finance and admin still
  read them correctly. Only the `tierId` link is null.
- **Reseller ids were retired, not deleted.** These 28 answer "discontinued"
  forever instead of 404:

  `29, 38, 45, 47, 85, 90, 97, 99, 100, 111, 206, 215, 217, 270, 272, 274, 275, 276, 277, 278, 284, 287, 314, 333, 334, 338, 341, 9918`

## The services, duplicates grouped as one

| Platform | Service | Tiers removed (orders) | Total | First | Last |
|---|---|---|---|---|---|
| Instagram | Instagram Followers | Budget (1129) | 1129 | 2026-05-30 | 2026-09-14 |
| Facebook | Facebook Post Likes | Budget (111), Standard (41) | 152 | 2026-06-05 | 2026-08-27 |
| tiktok | TikTok Followers | Budget (125) | 125 | 2026-07-18 | 2026-08-22 |
| Twitter/X | X/Twitter Followers | Budget (88), Standard (21) | 109 | 2026-05-17 | 2026-09-06 |
| Facebook | Facebook Page Followers | Budget (105) | 105 | 2026-05-13 | 2026-07-29 |
| Instagram | Instagram Reel/Video Views | Standard (85) | 85 | 2026-06-08 | 2026-07-10 |
| Instagram | Instagram Likes — Nigerian 🇳🇬 | Budget (16), Premium (2), Standard (24) | 42 | 2026-06-09 | 2026-07-28 |
| YouTube | YouTube Likes | Budget (28), Standard (4) | 32 | 2026-05-27 | 2026-08-03 |
| YouTube | YouTube Subscribers — Nigerian 🇳🇬 | Budget (27) | 27 | 2026-07-18 | 2026-08-17 |
| tiktok | TikTok Comments | Budget (21) | 21 | 2026-07-18 | 2026-09-12 |
| YouTube | YouTube Subscribers | Premium (3), Standard (9) | 12 | 2026-06-02 | 2026-07-30 |
| Instagram | Instagram Followers — Nigerian 🇳🇬 | Standard (11) | 11 | 2026-06-21 | 2026-07-09 |
| Twitter/X | X/Twitter Comments — Nigerian 🇳🇬 | Budget (10) | 10 | 2026-05-28 | 2026-08-08 |
| Twitter/X | X/Twitter Retweets | Budget (10) | 10 | 2026-06-03 | 2026-08-02 |
| YouTube | YouTube Subscribers 🇳🇬 | Budget (10) | 10 | 2026-08-19 | 2026-08-27 |
| Twitter/X | X/Twitter Followers — USA 🇺🇸 | Standard (9) | 9 | 2026-06-02 | 2026-07-07 |
| YouTube | YouTube Shorts Likes | Standard (6) | 6 | 2026-05-26 | 2026-08-19 |
| Facebook | Facebook Followers — Nigerian 🇳🇬 | Budget (5) | 5 | 2026-06-02 | 2026-08-15 |
| Spotify | Spotify Monthly Listeners | Budget (4) | 4 | 2026-06-15 | 2026-07-06 |
| Spotify | Spotify Saves | Standard (3) | 3 | 2026-07-09 | 2026-07-10 |
| Facebook | Facebook Followers 🇳🇬 | Budget (2) | 2 | 2026-08-23 | 2026-08-24 |
| Twitter/X | X/Twitter Comments 🇳🇬 | Budget (2) | 2 | 2026-09-10 | 2026-09-10 |
| Threads | Threads Followers | Standard (1) | 1 | 2026-08-13 | 2026-08-13 |
| Twitter/X | X/Twitter Followers 🇳🇬 | Budget (1) | 1 | 2026-08-19 | 2026-08-19 |

## To bring one back

Recreate the tier in the Menu Builder against the same service and price. It
gets a fresh reseller id — the retired one stays retired by design, because it
may already be hardcoded in somebody else's panel.

---

# Deleted tiers from disabled groups — 2026-09-16

A second pass: **101 tiers** across **62 disabled groups**. The groups
themselves are left in place. None of these were reachable — every group was
already switched off, so nothing customer-facing changes.

**Why delete rather than leave them off.** A service only enters the full list
when no tier points at it (`tiers: { none: {} }`). These tiers were holding
**82 services** out of the full list while delivering nothing themselves. With
the tiers gone, the next `sync-services` cron mints an id for each and they
become orderable again — sold as listed rather than tiered.

## The groups, duplicates grouped as one

| Platform | Group | Tiers removed | Orders | Last | Reseller ids retired |
|---|---|---|---|---|---|
| Instagram | Instagram Shares | Standard ₦418/1k · 35 orders<br>Budget ₦161/1k · 115 orders<br>Premium ₦1,285/1k · 25 orders | 175 | 2026-08-02 | 118, 116, 117 |
| TikTok | TikTok Followers | Standard ₦14,511/1k · 3 orders<br>Budget ₦5,457/1k · 34 orders<br>Premium ₦24,403/1k | 37 | 2026-06-14 | 230, 229 |
| Instagram | Instagram Random Comments | Budget ₦3,507/1k · 33 orders<br>Standard ₦4,559/1k · 2 orders | 35 | 2026-07-10 | 103, 104 |
| TikTok | TikTok Likes | Standard ₦1,676/1k<br>Premium ₦2,251/1k<br>Budget ₦1,583/1k · 25 orders | 25 | 2026-06-14 | 234, 233, 232 |
| Instagram | Instagram VIP Followers | Standard ₦15,821/1k · 1 orders<br>Premium ₦119,523/1k · 1 orders<br>Budget ₦34,750/1k · 18 orders | 20 | 2026-07-07 | 125, 124, 123 |
| TikTok | TikTok Video Views | Standard ₦627/1k · 1 orders<br>Budget ₦161/1k · 10 orders<br>Premium ₦900/1k · 3 orders | 14 | 2026-06-13 | 259, 257, 258 |
| Instagram | Instagram Video Views — USA 🇺🇸 | Premium ₦1,285/1k · 13 orders | 13 | 2026-07-10 | 122 |
| Facebook | Facebook Random Comments | Standard ₦11,977/1k · 2 orders<br>Budget ₦9,213/1k · 8 orders<br>Premium ₦62,618/1k | 10 | 2026-07-09 | 58, 56, 57 |
| Facebook | Facebook Post Reactions (Love ❤️) | Standard ₦1,600/1k · 8 orders | 8 | 2026-07-08 | 51 |
| Instagram | Instagram Auto Reach + Profile Visit | Standard ₦1,448/1k · 6 orders | 6 | 2026-06-20 | 74 |
| TikTok | TikTok Likes + Views | Premium ₦4,313/1k · 3 orders<br>Standard ₦3,657/1k · 3 orders | 6 | 2026-06-14 | 237, 238 |
| Instagram | Instagram Emoji Comments | Budget ₦11,162/1k · 5 orders | 5 | 2026-07-06 | 84 |
| TikTok | TikTok Shares | Budget ₦1,641/1k · 3 orders<br>Standard ₦1,829/1k · 2 orders | 5 | 2026-06-13 | 253, 254 |
| YouTube | YouTube Live Stream Views | Premium ₦4,451/1k · 1 orders<br>Standard ₦2,971/1k<br>Budget ₦1,172/1k · 3 orders | 4 | 2026-07-09 | 324, 325, 323 |
| YouTube | YouTube SEO Views 🇺🇸 | Standard ₦6,481/1k · 3 orders<br>Premium ₦11,907/1k<br>Budget ₦2,926/1k · 1 orders | 4 | 2026-07-07 | 329, 328, 327 |
| TikTok | TikTok Custom Comments | Budget ₦11,434/1k · 3 orders<br>Standard ₦17,648/1k | 3 | 2026-06-13 | 226, 227 |
| Facebook | Facebook Comment Reactions 🇳🇬 | Standard ₦42,661/1k · 2 orders | 2 | 2026-07-09 | 23 |
| Instagram | Instagram Growth Packages | Budget ₦14,459/1k · 2 orders<br>Premium ₦182,983/1k<br>Standard ₦74,322/1k | 2 | 2026-07-07 | 91, 92, 93 |
| Instagram | Instagram Premium Likes | Premium ₦1,969/1k · 2 orders | 2 | 2026-06-09 | 102 |
| Instagram | Instagram Auto Views (Reels) | Standard ₦940/1k · 2 orders | 2 | 2026-07-06 | 76 |
| Facebook | Facebook Post Reactions (Haha 😂) | Standard ₦1,600/1k · 1 orders | 1 | 2026-06-28 | 50 |
| Facebook | Facebook Custom Comments | Standard ₦11,194/1k · 1 orders | 1 | 2026-06-24 | 27 |
| Instagram | Instagram Auto Saves | Standard ₦940/1k · 1 orders | 1 | 2026-06-23 | 75 |
| TikTok | TikTok Likes 🇺🇸 | Premium ₦2,626/1k<br>Standard ₦4,260/1k · 1 orders | 1 | 2026-06-13 | 235, 236 |
| TikTok | TikTok Random Comments | Budget ₦12,033/1k · 1 orders | 1 | 2026-06-11 | 248 |
| YouTube | YouTube Random Comments | Budget ₦7,335/1k · 1 orders | 1 | 2026-06-27 | 326 |
| Facebook | Facebook Live Stream Views | Standard ₦3,194/1k<br>Budget ₦1,993/1k | 0 | — | 37, 36 |
| Facebook | Facebook Post Reactions 🇳🇬 | Standard ₦42,661/1k<br>Premium ₦52,506/1k | 0 | — | 53, 52 |
| Facebook | Facebook Event Interest 🇳🇬 | Standard ₦54,813/1k | 0 | — | 28 |
| Instagram | Instagram Reel Comments | Premium ₦229,350/1k<br>Budget ₦120,217/1k<br>Standard ₦186,347/1k | 0 | — | 108 |
| OnlyFans | OnlyFans Likes | Standard ₦89,536/1k<br>Budget ₦65,744/1k | 0 | — | 147, 146 |
| OnlyFans | OnlyFans Followers | Premium ₦125,226/1k<br>Budget ₦65,744/1k<br>Standard ₦89,536/1k | 0 | — | 144, 143, 145 |
| Pinterest | Pinterest Likes | Premium ₦86,232/1k<br>Standard ₦43,700/1k | 0 | — | 149, 150 |
| Pinterest | Pinterest Followers | Standard ₦43,141/1k | 0 | — | 148 |
| Pinterest | Pinterest Saves | Standard ₦47,430/1k | 0 | — | 152 |
| Pinterest | Pinterest Real Followers | Premium ₦297,844/1k | 0 | — | 151 |
| Quora | Quora Shares | Standard ₦7,796/1k | 0 | — | 154 |
| Quora | Quora Followers | Standard ₦7,514/1k | 0 | — | 153 |
| Quora | Quora Views | Standard ₦1,372/1k | 0 | — | 156 |
| Quora | Quora Upvotes | Standard ₦7,796/1k | 0 | — | 155 |
| Reddit | Reddit Views | Budget ₦402/1k<br>Standard ₦522/1k | 0 | — | 158, 159 |
| Reddit | Reddit Views + Shares | Standard ₦1,044/1k | 0 | — | 162 |
| Reddit | Reddit Views — UK | Premium ₦1,413/1k | 0 | — | 160 |
| Reddit | Reddit Shares | Standard ₦522/1k | 0 | — | 157 |
| Reddit | Reddit Views 🇺🇸 | Premium ₦1,413/1k | 0 | — | 161 |
| SoundCloud | SoundCloud Plays | Standard ₦2,591/1k | 0 | — | 177 |
| Spotify | Spotify Podcast Plays | Standard ₦2,322/1k | 0 | — | — |
| TikTok | TikTok Story Views | Standard ₦1,814/1k | 0 | — | — |
| TikTok | TikTok Story Likes | Budget ₦1,700/1k | 0 | — | 255 |
| TikTok | TikTok Monetization Views | Budget ₦562/1k<br>Standard ₦940/1k | 0 | — | 245, 246 |
| TikTok | TikTok Views 🇳🇬 | Standard ₦17,702/1k | 0 | — | 260 |
| TikTok | TikTok Live Stream Views | Standard ₦24,666/1k<br>Premium ₦71,822/1k<br>Budget ₦5,672/1k | 0 | — | 244, 243, 242 |
| TikTok | TikTok Saves | Budget ₦322/1k<br>Premium ₦756/1k<br>Standard ₦410/1k | 0 | — | 249, 250, 251 |
| TikTok | TikTok PK Battle Points | Standard ₦1,253/1k | 0 | — | 247 |
| TikTok | TikTok Live Stream Likes | Budget ₦803/1k<br>Standard ₦418/1k | 0 | — | 240, 241 |
| TikTok | TikTok Use Sound 🇳🇬 | Premium ₦545,942/1k | 0 | — | 256 |
| TikTok | TikTok Duet 🇳🇬 | Premium ₦253,534/1k | 0 | — | 228 |
| TikTok | TikTok Saves 🇳🇬 | Standard ₦27,257/1k | 0 | — | 252 |
| Tumblr | Tumblr Reblogs | Standard ₦79,393/1k | 0 | — | 264 |
| Tumblr | Tumblr Likes | Standard ₦44,111/1k | 0 | — | 263 |
| Tumblr | Tumblr Followers | Premium ₦94,979/1k | 0 | — | 262 |
| YouTube | YouTube Live Stream Likes | Premium ₦4,501/1k<br>Standard ₦3,429/1k | 0 | — | 321, 322 |

## To rebuild one

The group still exists and is still disabled. Re-enable it, recreate the tiers
above against the same provider service, and re-enter the price. The tier gets a
fresh reseller id; the retired one stays retired, because it may already sit in
somebody's panel.
