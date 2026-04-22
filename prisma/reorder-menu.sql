-- Nitro Menu Reorder Script
-- Groups Nigerian services next to their parent + orders by service importance
-- Paste into Neon SQL Editor

DO $$
DECLARE
  rec RECORD;
  sort_counter INT := 1;
BEGIN
  -- Reorder all service groups
  FOR rec IN
    SELECT 
      sg.id,
      sg.name,
      sg.platform,
      sg.type,
      sg.nigerian,
      -- Platform order
      CASE sg.platform
        WHEN 'Instagram' THEN 1
        WHEN 'TikTok' THEN 2
        WHEN 'YouTube' THEN 3
        WHEN 'Twitter/X' THEN 4
        WHEN 'Facebook' THEN 5
        WHEN 'Telegram' THEN 6
        WHEN 'Threads' THEN 7
        WHEN 'Spotify' THEN 8
        WHEN 'Snapchat' THEN 9
        WHEN 'LinkedIn' THEN 10
        WHEN 'Pinterest' THEN 11
        WHEN 'Twitch' THEN 12
        WHEN 'Discord' THEN 13
        WHEN 'Reddit' THEN 14
        WHEN 'Clubhouse' THEN 15
        WHEN 'Audiomack' THEN 16
        WHEN 'Boomplay' THEN 17
        WHEN 'SoundCloud' THEN 18
        WHEN 'Apple Music' THEN 19
        WHEN 'Shazam' THEN 20
        WHEN 'WhatsApp' THEN 21
        WHEN 'OnlyFans' THEN 22
        WHEN 'TrustPilot' THEN 23
        WHEN 'Google' THEN 24
        WHEN 'Quora' THEN 25
        ELSE 99
      END as plat_order,
      -- Type priority  
      CASE sg.type
        WHEN 'followers' THEN 1
        WHEN 'likes' THEN 2
        WHEN 'views' THEN 3
        WHEN 'engagement' THEN 4
        WHEN 'plays' THEN 5
        WHEN 'reviews' THEN 6
        ELSE 7
      END as type_order,
      -- Nigerian services sort after their non-Nigerian counterpart
      CASE WHEN sg.nigerian THEN 1 ELSE 0 END as ng_order,
      -- Secondary sort: by name to group similar services
      -- Strip "— Nigeria 🇳🇬" and "— USA 🇺🇸" etc for grouping
      REGEXP_REPLACE(sg.name, ' — (Nigeria|USA|Fast).*$', '') as base_name
    FROM service_groups sg
    ORDER BY 
      plat_order ASC,      -- Platform priority
      type_order ASC,       -- Service type priority (followers > likes > views...)
      base_name ASC,        -- Group similar services together
      ng_order ASC,         -- Non-Nigerian first, Nigerian right after
      sg.name ASC           -- Alphabetical tiebreaker
  LOOP
    UPDATE service_groups SET "sortOrder" = sort_counter WHERE id = rec.id;
    sort_counter := sort_counter + 1;
  END LOOP;

  RAISE NOTICE 'Reordered % service groups', sort_counter - 1;
END $$;

