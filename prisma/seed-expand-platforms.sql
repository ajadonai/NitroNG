-- ══════════════════════════════════════════════════════════
-- Nitro: Additional platforms + expanded services seed
-- Run in Neon SQL Editor
-- 
-- Adds: WhatsApp (4), Google Reviews (2), Boomplay (2),
--        Apple Music (2), Rumble (3), Likee (3), 
--        DailyMotion (3), Clubhouse (2)
-- Total: 21 new groups + tiers
-- ══════════════════════════════════════════════════════════

-- ═══ WHATSAPP — expand from 1 to 5 groups ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_wa_channel_followers', 'WhatsApp Channel Followers', 'WhatsApp', 'followers', true, 2010, NOW(), NOW()),
  ('sg_wa_group_members', 'WhatsApp Group Members', 'WhatsApp', 'followers', true, 2020, NOW(), NOW()),
  ('sg_wa_status_views', 'WhatsApp Status Views', 'WhatsApp', 'views', true, 2030, NOW(), NOW()),
  ('sg_wa_channel_views', 'WhatsApp Channel Post Views', 'WhatsApp', 'views', true, 2040, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_wa_channel_followers_s', 'sg_wa_channel_followers', 'Standard', 4500, 1500, true, NOW(), NOW()),
  ('st_wa_channel_followers_p', 'sg_wa_channel_followers', 'Premium', 7500, 2500, true, NOW(), NOW()),
  ('st_wa_group_members_s', 'sg_wa_group_members', 'Standard', 6000, 2000, true, NOW(), NOW()),
  ('st_wa_group_members_p', 'sg_wa_group_members', 'Premium', 9000, 3000, true, NOW(), NOW()),
  ('st_wa_status_views_s', 'sg_wa_status_views', 'Standard', 1500, 500, true, NOW(), NOW()),
  ('st_wa_status_views_p', 'sg_wa_status_views', 'Premium', 3000, 1000, true, NOW(), NOW()),
  ('st_wa_channel_views_s', 'sg_wa_channel_views', 'Standard', 1200, 400, true, NOW(), NOW()),
  ('st_wa_channel_views_p', 'sg_wa_channel_views', 'Premium', 2400, 800, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ GOOGLE REVIEWS ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_google_reviews', 'Google Reviews (5-Star)', 'Google Reviews', 'engagement', true, 2110, NOW(), NOW()),
  ('sg_google_map_views', 'Google Maps Views', 'Google Reviews', 'views', true, 2120, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_google_reviews_s', 'sg_google_reviews', 'Standard', 150000, 50000, true, NOW(), NOW()),
  ('st_google_reviews_p', 'sg_google_reviews', 'Premium', 250000, 85000, true, NOW(), NOW()),
  ('st_google_map_views_s', 'sg_google_map_views', 'Standard', 3000, 1000, true, NOW(), NOW()),
  ('st_google_map_views_p', 'sg_google_map_views', 'Premium', 6000, 2000, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ BOOMPLAY — expand from 3 to 5 groups ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_bp_streams', 'Boomplay Streams', 'Boomplay', 'views', true, 2210, NOW(), NOW()),
  ('sg_bp_playlist', 'Boomplay Playlist Adds', 'Boomplay', 'engagement', true, 2220, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_bp_streams_b', 'sg_bp_streams', 'Budget', 1200, 400, true, NOW(), NOW()),
  ('st_bp_streams_s', 'sg_bp_streams', 'Standard', 2400, 800, true, NOW(), NOW()),
  ('st_bp_streams_p', 'sg_bp_streams', 'Premium', 4500, 1500, true, NOW(), NOW()),
  ('st_bp_playlist_s', 'sg_bp_playlist', 'Standard', 6000, 2000, true, NOW(), NOW()),
  ('st_bp_playlist_p', 'sg_bp_playlist', 'Premium', 10000, 3500, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ APPLE MUSIC — expand from 2 to 4 groups ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_am_presave', 'Apple Music Pre-Saves', 'Apple Music', 'engagement', true, 2310, NOW(), NOW()),
  ('sg_am_playlist', 'Apple Music Playlist Adds', 'Apple Music', 'engagement', true, 2320, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_am_presave_s', 'sg_am_presave', 'Standard', 9000, 3000, true, NOW(), NOW()),
  ('st_am_presave_p', 'sg_am_presave', 'Premium', 15000, 5000, true, NOW(), NOW()),
  ('st_am_playlist_s', 'sg_am_playlist', 'Standard', 12000, 4000, true, NOW(), NOW()),
  ('st_am_playlist_p', 'sg_am_playlist', 'Premium', 20000, 7000, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ RUMBLE — new platform ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_rumble_views', 'Rumble Views', 'Rumble', 'views', true, 2410, NOW(), NOW()),
  ('sg_rumble_subs', 'Rumble Subscribers', 'Rumble', 'followers', true, 2420, NOW(), NOW()),
  ('sg_rumble_likes', 'Rumble Likes', 'Rumble', 'likes', true, 2430, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_rumble_views_b', 'sg_rumble_views', 'Budget', 900, 300, true, NOW(), NOW()),
  ('st_rumble_views_s', 'sg_rumble_views', 'Standard', 1800, 600, true, NOW(), NOW()),
  ('st_rumble_views_p', 'sg_rumble_views', 'Premium', 3600, 1200, true, NOW(), NOW()),
  ('st_rumble_subs_s', 'sg_rumble_subs', 'Standard', 6000, 2000, true, NOW(), NOW()),
  ('st_rumble_subs_p', 'sg_rumble_subs', 'Premium', 10000, 3500, true, NOW(), NOW()),
  ('st_rumble_likes_s', 'sg_rumble_likes', 'Standard', 1500, 500, true, NOW(), NOW()),
  ('st_rumble_likes_p', 'sg_rumble_likes', 'Premium', 3000, 1000, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ LIKEE — new platform ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_likee_followers', 'Likee Followers', 'Likee', 'followers', true, 2510, NOW(), NOW()),
  ('sg_likee_likes', 'Likee Likes', 'Likee', 'likes', true, 2520, NOW(), NOW()),
  ('sg_likee_views', 'Likee Views', 'Likee', 'views', true, 2530, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_likee_followers_b', 'sg_likee_followers', 'Budget', 2400, 800, true, NOW(), NOW()),
  ('st_likee_followers_s', 'sg_likee_followers', 'Standard', 4500, 1500, true, NOW(), NOW()),
  ('st_likee_followers_p', 'sg_likee_followers', 'Premium', 7500, 2500, true, NOW(), NOW()),
  ('st_likee_likes_s', 'sg_likee_likes', 'Standard', 1200, 400, true, NOW(), NOW()),
  ('st_likee_likes_p', 'sg_likee_likes', 'Premium', 2400, 800, true, NOW(), NOW()),
  ('st_likee_views_b', 'sg_likee_views', 'Budget', 600, 200, true, NOW(), NOW()),
  ('st_likee_views_s', 'sg_likee_views', 'Standard', 1200, 400, true, NOW(), NOW()),
  ('st_likee_views_p', 'sg_likee_views', 'Premium', 2400, 800, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ DAILYMOTION — new platform ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_dm_views', 'DailyMotion Views', 'DailyMotion', 'views', true, 2610, NOW(), NOW()),
  ('sg_dm_subs', 'DailyMotion Subscribers', 'DailyMotion', 'followers', true, 2620, NOW(), NOW()),
  ('sg_dm_likes', 'DailyMotion Likes', 'DailyMotion', 'likes', true, 2630, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_dm_views_b', 'sg_dm_views', 'Budget', 750, 250, true, NOW(), NOW()),
  ('st_dm_views_s', 'sg_dm_views', 'Standard', 1500, 500, true, NOW(), NOW()),
  ('st_dm_views_p', 'sg_dm_views', 'Premium', 3000, 1000, true, NOW(), NOW()),
  ('st_dm_subs_s', 'sg_dm_subs', 'Standard', 6000, 2000, true, NOW(), NOW()),
  ('st_dm_subs_p', 'sg_dm_subs', 'Premium', 10000, 3500, true, NOW(), NOW()),
  ('st_dm_likes_s', 'sg_dm_likes', 'Standard', 1200, 400, true, NOW(), NOW()),
  ('st_dm_likes_p', 'sg_dm_likes', 'Premium', 2400, 800, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ═══ CLUBHOUSE — new platform ═══

INSERT INTO service_groups (id, name, platform, type, enabled, "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('sg_ch_followers', 'Clubhouse Followers', 'Clubhouse', 'followers', true, 2710, NOW(), NOW()),
  ('sg_ch_room', 'Clubhouse Room Listeners', 'Clubhouse', 'views', true, 2720, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_tiers (id, "groupId", tier, "sellPer1k", "costPer1k", enabled, "createdAt", "updatedAt")
VALUES
  ('st_ch_followers_s', 'sg_ch_followers', 'Standard', 7500, 2500, true, NOW(), NOW()),
  ('st_ch_followers_p', 'sg_ch_followers', 'Premium', 12000, 4000, true, NOW(), NOW()),
  ('st_ch_room_s', 'sg_ch_room', 'Standard', 4500, 1500, true, NOW(), NOW()),
  ('st_ch_room_p', 'sg_ch_room', 'Premium', 7500, 2500, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- SUMMARY: +21 groups, +52 tiers, +4 new platforms
-- New totals: ~177 groups, ~286 tiers, 33 platforms
-- ══════════════════════════════════════════════════════════

-- Verify
SELECT 'AFTER SEED' as status,
  (SELECT COUNT(*) FROM service_groups) as groups,
  (SELECT COUNT(*) FROM service_tiers) as tiers,
  (SELECT COUNT(DISTINCT platform) FROM service_groups) as platforms;
