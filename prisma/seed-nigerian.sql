-- Nitro Nigerian Services Seed
-- Paste this into Neon SQL Editor
-- After running, hit "Recalculate All Prices" in Admin Settings

-- Remove existing Nigerian groups + their tiers
DELETE FROM service_tiers WHERE "groupId" IN (SELECT id FROM service_groups WHERE nigerian = true);
DELETE FROM service_groups WHERE nigerian = true;

-- Get max sort order
DO $$
DECLARE
  sort_base INT;
  grp_id TEXT;
  svc_id TEXT;
  tier_sort INT;
BEGIN
  SELECT COALESCE(MAX("sortOrder"), 0) + 1 INTO sort_base FROM service_groups;

  -- Instagram: Instagram Followers — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_1', 'Instagram Followers — Nigeria 🇳🇬', 'Instagram', 'followers', true, true, sort_base + 0, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 5752 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_1_1', 'ng_grp_1', svc_id, 'Budget', 0, false, '1-5K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 5839 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_1_2', 'ng_grp_1', svc_id, 'Standard', 0, true, '5-10K/day', true, 2, NOW(), NOW());
  END IF;

  -- Instagram: Instagram Likes — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_2', 'Instagram Likes — Nigeria 🇳🇬', 'Instagram', 'likes', true, true, sort_base + 1, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2847 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_2_1', 'ng_grp_2', svc_id, 'Budget', 0, false, '5-10K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2499 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_2_2', 'ng_grp_2', svc_id, 'Standard', 0, true, '5-15K/day', true, 2, NOW(), NOW());
  END IF;

  -- Instagram: Instagram Reel Views — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_3', 'Instagram Reel Views — Nigeria 🇳🇬', 'Instagram', 'views', true, true, sort_base + 2, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 7661 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_3_1', 'ng_grp_3', svc_id, 'Budget', 0, false, '10-20M/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2127 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_3_2', 'ng_grp_3', svc_id, 'Standard', 0, true, '100-500K/day', true, 2, NOW(), NOW());
  END IF;

  -- Instagram: Instagram Story Views — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_4', 'Instagram Story Views — Nigeria 🇳🇬', 'Instagram', 'views', true, true, sort_base + 3, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 3516 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_4_1', 'ng_grp_4', svc_id, 'Standard', 0, false, '50-100K/day', true, 1, NOW(), NOW());
  END IF;

  -- TikTok: TikTok Followers — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_5', 'TikTok Followers — Nigeria 🇳🇬', 'TikTok', 'followers', true, true, sort_base + 4, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2594 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_5_1', 'ng_grp_5', svc_id, 'Standard', 0, false, '500-2K/day', true, 1, NOW(), NOW());
  END IF;

  -- TikTok: TikTok Video Views — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_6', 'TikTok Video Views — Nigeria 🇳🇬', 'TikTok', 'views', true, true, sort_base + 5, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2026 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_6_1', 'ng_grp_6', svc_id, 'Budget', 0, false, '5-50K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 9349 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_6_2', 'ng_grp_6', svc_id, 'Standard', 0, true, '500-1M/day', true, 2, NOW(), NOW());
  END IF;

  -- TikTok: TikTok Likes — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_7', 'TikTok Likes — Nigeria 🇳🇬', 'TikTok', 'likes', true, true, sort_base + 6, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 1128 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_7_1', 'ng_grp_7', svc_id, 'Budget', 0, false, '5-50K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 1126 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_7_2', 'ng_grp_7', svc_id, 'Standard', 0, true, '5-50K/day', true, 2, NOW(), NOW());
  END IF;

  -- Twitter/X: X/Twitter Followers — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_8', 'X/Twitter Followers — Nigeria 🇳🇬', 'Twitter/X', 'followers', true, true, sort_base + 7, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 5125 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_8_1', 'ng_grp_8', svc_id, 'Budget', 0, false, '1-5K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2594 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_8_2', 'ng_grp_8', svc_id, 'Standard', 0, false, '500-2K/day', true, 2, NOW(), NOW());
  END IF;

  -- Twitter/X: X/Twitter Likes — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_9', 'X/Twitter Likes — Nigeria 🇳🇬', 'Twitter/X', 'likes', true, true, sort_base + 8, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 3663 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_9_1', 'ng_grp_9', svc_id, 'Budget', 0, false, '500-1K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 3661 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_9_2', 'ng_grp_9', svc_id, 'Standard', 0, true, '500-1K/day', true, 2, NOW(), NOW());
  END IF;

  -- Twitter/X: X/Twitter Retweets — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_10', 'X/Twitter Retweets — Nigeria 🇳🇬', 'Twitter/X', 'engagement', true, true, sort_base + 9, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 1604 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_10_1', 'ng_grp_10', svc_id, 'Budget', 0, false, '500-1K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 3308 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_10_2', 'ng_grp_10', svc_id, 'Standard', 0, true, '500-1K/day', true, 2, NOW(), NOW());
  END IF;

  -- Twitter/X: X/Twitter Tweet Views — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_11', 'X/Twitter Tweet Views — Nigeria 🇳🇬', 'Twitter/X', 'views', true, true, sort_base + 10, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 981 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_11_1', 'ng_grp_11', svc_id, 'Budget', 0, false, '100-500K/day', true, 1, NOW(), NOW());
  END IF;

  -- YouTube: YouTube Views — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_12', 'YouTube Views — Nigeria 🇳🇬', 'YouTube', 'views', true, true, sort_base + 11, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 1573 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_12_1', 'ng_grp_12', svc_id, 'Standard', 0, true, '100-500/day', true, 1, NOW(), NOW());
  END IF;

  -- YouTube: YouTube Likes — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_13', 'YouTube Likes — Nigeria 🇳🇬', 'YouTube', 'likes', true, true, sort_base + 12, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 935 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_13_1', 'ng_grp_13', svc_id, 'Budget', 0, false, '10-100K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 918 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_13_2', 'ng_grp_13', svc_id, 'Standard', 0, true, '5-10K/day', true, 2, NOW(), NOW());
  END IF;

  -- YouTube: YouTube Subscribers — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_14', 'YouTube Subscribers — Nigeria 🇳🇬', 'YouTube', 'followers', true, true, sort_base + 13, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 2386 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_14_1', 'ng_grp_14', svc_id, 'Budget', 0, false, '10-50K/day', true, 1, NOW(), NOW());
  END IF;

  -- Facebook: Facebook Page Followers — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_15', 'Facebook Page Followers — Nigeria 🇳🇬', 'Facebook', 'followers', true, true, sort_base + 14, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 4138 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_15_1', 'ng_grp_15', svc_id, 'Budget', 0, false, '1-5K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 9028 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_15_2', 'ng_grp_15', svc_id, 'Standard', 0, true, '5-15K/day', true, 2, NOW(), NOW());
  END IF;

  -- Facebook: Facebook Post Likes — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_16', 'Facebook Post Likes — Nigeria 🇳🇬', 'Facebook', 'likes', true, true, sort_base + 15, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 578 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_16_1', 'ng_grp_16', svc_id, 'Budget', 0, false, '500-1K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 5133 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_16_2', 'ng_grp_16', svc_id, 'Standard', 0, true, '500-2K/day', true, 2, NOW(), NOW());
  END IF;

  -- Facebook: Facebook Video Views — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_17', 'Facebook Video Views — Nigeria 🇳🇬', 'Facebook', 'views', true, true, sort_base + 16, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 680 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_17_1', 'ng_grp_17', svc_id, 'Budget', 0, false, '20-30K/day', true, 1, NOW(), NOW());
  END IF;

  SELECT id INTO svc_id FROM services WHERE "apiId" = 7654 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_17_2', 'ng_grp_17', svc_id, 'Standard', 0, true, '5-15K/day', true, 2, NOW(), NOW());
  END IF;

  -- Telegram: Telegram Members — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_18', 'Telegram Members — Nigeria 🇳🇬', 'Telegram', 'followers', true, true, sort_base + 17, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 8248 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_18_1', 'ng_grp_18', svc_id, 'Standard', 0, false, '5-10K/day', true, 1, NOW(), NOW());
  END IF;

  -- Spotify: Spotify Streams — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_19', 'Spotify Streams — Nigeria 🇳🇬', 'Spotify', 'plays', true, true, sort_base + 18, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 6543 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_19_1', 'ng_grp_19', svc_id, 'Standard', 0, false, '500-2K/day', true, 1, NOW(), NOW());
  END IF;

  -- Threads: Threads Followers — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_20', 'Threads Followers — Nigeria 🇳🇬', 'Threads', 'followers', true, true, sort_base + 19, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 8575 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_20_1', 'ng_grp_20', svc_id, 'Standard', 0, false, '1-5K/day', true, 1, NOW(), NOW());
  END IF;

  -- Threads: Threads Likes — Nigeria 🇳🇬
  INSERT INTO service_groups (id, name, platform, type, nigerian, enabled, "sortOrder", "createdAt", "updatedAt")
  VALUES ('ng_grp_21', 'Threads Likes — Nigeria 🇳🇬', 'Threads', 'likes', true, true, sort_base + 20, NOW(), NOW());

  SELECT id INTO svc_id FROM services WHERE "apiId" = 8578 LIMIT 1;
  IF svc_id IS NOT NULL THEN
    INSERT INTO service_tiers (id, "groupId", "serviceId", tier, "sellPer1k", refill, speed, enabled, "sortOrder", "createdAt", "updatedAt")
    VALUES ('ng_tier_21_1', 'ng_grp_21', svc_id, 'Standard', 0, false, '5-10K/day', true, 1, NOW(), NOW());
  END IF;

  RAISE NOTICE 'Nigerian services seeded! Run Recalculate All Prices in Admin Settings.';
END $$;

