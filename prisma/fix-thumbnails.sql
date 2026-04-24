-- Fix all duplicate/missing blog post thumbnails + author names
-- Run in Neon SQL editor

-- instagram grow + best-time were sharing a thumbnail
UPDATE blog_posts SET thumbnail = '/blog/grow-instagram-nigeria.svg' WHERE slug = 'how-to-grow-instagram-account-nigeria';
UPDATE blog_posts SET thumbnail = '/blog/best-time-instagram.svg' WHERE slug = 'best-time-to-post-instagram-nigeria';

-- service-tiers-explained + telegram were sharing a thumbnail
UPDATE blog_posts SET thumbnail = '/blog/service-tiers.svg' WHERE slug = 'service-tiers-explained';
UPDATE blog_posts SET thumbnail = '/blog/telegram-members.svg' WHERE slug = 'how-to-buy-telegram-members-nigeria';

-- three safety/drop posts were sharing a thumbnail
UPDATE blog_posts SET thumbnail = '/blog/smm-safety-guide.svg' WHERE slug = 'is-smm-safe';
UPDATE blog_posts SET thumbnail = '/blog/is-smm-safe.svg' WHERE slug = 'is-buying-social-media-followers-safe';
UPDATE blog_posts SET thumbnail = '/blog/followers-drop.svg' WHERE slug = 'why-instagram-followers-drop-after-buying';

-- reseller + referral were sharing a thumbnail
UPDATE blog_posts SET thumbnail = '/blog/smm-reseller-business.svg' WHERE slug = 'how-to-start-smm-reseller-business-nigeria';
UPDATE blog_posts SET thumbnail = '/blog/referral-program.svg' WHERE slug = 'referral-program';

-- missing thumbnails
UPDATE blog_posts SET thumbnail = '/blog/smm-panel-comparison.svg' WHERE slug = 'best-smm-panel-nigeria-2026-comparison';
UPDATE blog_posts SET thumbnail = '/blog/leaderboard.svg' WHERE slug = 'leaderboard';

-- Standardize all author names to "Nitro Team"
UPDATE blog_posts SET "authorName" = 'Nitro Team' WHERE "authorName" != 'Nitro Team';
