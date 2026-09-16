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
