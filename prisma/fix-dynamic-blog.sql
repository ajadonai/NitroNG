-- Add dynamic tokens to blog posts so they pull live values from settings
-- Run in Neon SQL editor

-- Referral post: replace vague "percentage" with actual bonus tokens
UPDATE blog_posts SET content = REPLACE(
  REPLACE(content,
    'A percentage of your referral''s first deposit is credited to your wallet',
    '<strong>You (referrer):</strong> {{referrer_bonus}} credited to your wallet</li><li><strong>Your friend (invitee):</strong> {{invitee_bonus}} bonus on signup'
  ),
  'When someone signs up and funds their wallet, you earn a bonus',
  'When someone signs up and funds their wallet, you both earn a bonus'
) WHERE slug = 'referral-program';

-- Add funds post: replace hardcoded minimum deposit
UPDATE blog_posts SET content = REPLACE(content, 'Minimum deposit: ₦500', 'Minimum deposit: {{min_deposit}}') WHERE slug = 'how-to-add-funds';

-- First order post: replace hardcoded platform count
UPDATE blog_posts SET content = REPLACE(content, 'and 24 more', 'and {{platform_count}}+ more') WHERE slug = 'how-to-place-your-first-order';
