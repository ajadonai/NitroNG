-- ══════════════════════════════════════════════════
-- NITRO SEED: 6,823 users + ~25,200 orders
-- Run in Neon SQL Editor (paste in chunks if needed)
-- ══════════════════════════════════════════════════

-- Step 1: Create temp tables for name generation
CREATE TEMP TABLE first_names_m (name TEXT);
CREATE TEMP TABLE first_names_f (name TEXT);
CREATE TEMP TABLE last_names (name TEXT);

INSERT INTO first_names_m VALUES
('Adebayo'),('Chinedu'),('Oluwaseun'),('Emeka'),('Ibrahim'),('Tunde'),('Obinna'),('Yusuf'),('Femi'),('Ikenna'),
('Damilare'),('Chibueze'),('Olumide'),('Abdullahi'),('Kayode'),('Nnamdi'),('Segun'),('Uche'),('Musa'),('Babatunde'),
('Adekunle'),('Chukwuma'),('Olamide'),('Hassan'),('Folarin'),('Ifeanyi'),('Jide'),('Abubakar'),('Rotimi'),('Kelechi'),
('Tobi'),('Ebuka'),('Ayomide'),('Suleiman'),('Gbenga'),('Onyeka'),('Lanre'),('Bashir'),('Wale'),('Uchechukwu'),
('Adewale'),('Chimdi'),('Oluwatobi'),('Idris'),('Kunle'),('Obiora'),('Dare'),('Aliyu'),('Biodun'),('Somtochukwu'),
('Temitope'),('Chidi'),('Akinwale'),('Nuhu'),('Ayo'),('Ugochukwu'),('Bode'),('Ismail'),('Niyi'),('Chukwudi'),
('Dapo'),('Kenechukwu'),('Seyi'),('Garba'),('Tayo'),('Okezie'),('Deji'),('Bello'),('Dotun'),('Nnaemeka'),
('Adeniyi'),('Chibuzor'),('Ojo'),('Haruna'),('Lekan'),('Azubuike'),('Jimi'),('Yakubu'),('Dayo'),('Chigozie');

INSERT INTO first_names_f VALUES
('Adesewa'),('Chiamaka'),('Oluwafunke'),('Ngozi'),('Aisha'),('Titilayo'),('Adaeze'),('Fatima'),('Bukola'),('Ifeoma'),
('Damilola'),('Chidinma'),('Omolara'),('Halima'),('Folake'),('Nneka'),('Temitayo'),('Amaka'),('Zainab'),('Yetunde'),
('Adeola'),('Chinyere'),('Olayinka'),('Hauwa'),('Funke'),('Ifunanya'),('Bimbo'),('Amina'),('Ronke'),('Kosisochukwu'),
('Tolulope'),('Ebele'),('Ayoola'),('Salamatu'),('Gbemisola'),('Ogechukwu'),('Lara'),('Bilkisu'),('Wuraola'),('Ujunwa'),
('Aderonke'),('Chidimma'),('Omolade'),('Hadiza'),('Kehinde'),('Obiageli'),('Shade'),('Rahama'),('Bola'),('Somkene'),
('Opeyemi'),('Adaobi'),('Abolanle'),('Nafisa'),('Toyin'),('Uloma'),('Morenike'),('Khadija'),('Sade'),('Chisom'),
('Ololade'),('Amarachi'),('Iyabo'),('Jamila'),('Motunrayo'),('Nkechi'),('Modupe'),('Maryam'),('Olabisi'),('Adaora'),
('Mojisola'),('Ogechi'),('Abimbola'),('Ruqayya'),('Omowunmi'),('Ginika'),('Temilade'),('Hassana'),('Jumoke'),('Nnenna');

INSERT INTO last_names VALUES
('Adeyemi'),('Okonkwo'),('Ibrahim'),('Balogun'),('Mohammed'),('Akintoye'),('Eze'),('Abdullahi'),('Ogundimu'),('Nwosu'),
('Bakare'),('Chukwu'),('Suleiman'),('Ojo'),('Emeka'),('Fasanya'),('Igwe'),('Yusuf'),('Adeleke'),('Okafor'),
('Coker'),('Nnaji'),('Bello'),('Akinyemi'),('Onuoha'),('Lawal'),('Amadi'),('Hassan'),('Olawale'),('Obiora'),
('Martins'),('Okoro'),('Abubakar'),('Alabi'),('Nwankwo'),('Salami'),('Udeh'),('Musa'),('Oloyede'),('Ikechukwu'),
('Bankole'),('Obi'),('Garba'),('Ayodeji'),('Anyanwu'),('Oladipo'),('Ezeani'),('Aliyu'),('Ogundele'),('Chidozie'),
('Afolabi'),('Mgbemena'),('Haruna'),('Owolabi'),('Ihejirika'),('Okeowo'),('Uzoma'),('Nuhu'),('Kolawole'),('Onyeama'),
('Oyelaran'),('Achebe'),('Yakubu'),('Babatunde'),('Okeke'),('Adeogun'),('Nwachukwu'),('Ismail'),('Adesanya'),('Opara'),
('Macaulay'),('Ikenna'),('Danjuma'),('Shokunbi'),('Agu'),('Oseni'),('Ezirim'),('Idris'),('Ajayi'),('Nwokocha'),
('Animashaun'),('Nzeribe'),('Shehu'),('Ogunlesi'),('Chime'),('Williams'),('Ibe'),('Ahmad'),('Peters'),('Offor'),
('Johnson'),('Eneh'),('Buhari'),('Akpan'),('Dimgba'),('Ogbonna'),('Tijani'),('George'),('Onu'),('Maduka');

-- Step 2: Generate 6823 users
INSERT INTO users (id, email, password, name, "firstName", "lastName", "referralCode", "emailVerified", balance, "createdAt")
SELECT
  'usr_' || md5(random()::text || i::text) AS id,
  LOWER(
    CASE WHEN random() < 0.3 THEN fn || '.' || ln
         WHEN random() < 0.6 THEN fn || ln || FLOOR(random() * 99 + 1)::int::text
         ELSE SUBSTRING(fn, 1, 1) || '.' || ln || FLOOR(random() * 999 + 1)::int::text
    END
  ) || '@' ||
  (ARRAY['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','mail.com'])[FLOOR(random()*6+1)] AS email,
  '$2a$12$LJ3m4qs5HvGNbSYGVF0KHeZZJf1vBnQJwBq3F6hFzKSGHEFqXhXKi' AS password,
  fn || ' ' || ln AS name,
  fn AS "firstName",
  ln AS "lastName",
  'NTR-' || UPPER(SUBSTRING(md5(random()::text), 1, 4)) AS "referralCode",
  true AS "emailVerified",
  0 AS balance,
  NOW() - (random() * INTERVAL '120 days') AS "createdAt"
FROM (
  SELECT i,
    (SELECT name FROM (
      SELECT name FROM first_names_m UNION ALL SELECT name FROM first_names_f
    ) all_fn ORDER BY random() LIMIT 1) AS fn,
    (SELECT name FROM last_names ORDER BY random() LIMIT 1) AS ln
  FROM generate_series(1, 6823) AS s(i)
) AS seed;

-- Step 3: Set ~1100 referrals (users referred by another user)
WITH referrers AS (
  SELECT id, "referralCode" FROM users WHERE "referralCode" IS NOT NULL ORDER BY random() LIMIT 300
),
to_update AS (
  SELECT u.id, r."referralCode"
  FROM users u
  CROSS JOIN LATERAL (SELECT "referralCode" FROM referrers ORDER BY random() LIMIT 1) r
  WHERE u."referredBy" IS NULL
  ORDER BY random()
  LIMIT 1100
)
UPDATE users SET "referredBy" = to_update."referralCode"
FROM to_update WHERE users.id = to_update.id;

-- Step 4: Generate orders (~25,200)
-- First, get service/tier IDs for each platform
INSERT INTO orders (id, "orderId", "userId", "serviceId", "tierId", link, quantity, charge, cost, status, "createdAt")
SELECT
  'ord_' || md5(random()::text || s.i::text),
  'ORD-' || UPPER(SUBSTRING(md5(random()::text || s.i::text), 1, 8)),
  u.id,
  st."serviceId",
  st.id,
  CASE platform
    WHEN 'instagram' THEN 'https://instagram.com/user' || FLOOR(random()*99999)::int
    WHEN 'tiktok' THEN 'https://tiktok.com/@user' || FLOOR(random()*99999)::int
    WHEN 'youtube' THEN 'https://youtube.com/watch?v=' || SUBSTRING(md5(random()::text),1,11)
    WHEN 'twitter' THEN 'https://x.com/user' || FLOOR(random()*99999)::int
    WHEN 'facebook' THEN 'https://facebook.com/profile/' || FLOOR(random()*999999)::int
    WHEN 'telegram' THEN 'https://t.me/channel' || FLOOR(random()*9999)::int
    WHEN 'spotify' THEN 'https://open.spotify.com/track/' || SUBSTRING(md5(random()::text),1,22)
    WHEN 'threads' THEN 'https://threads.net/@user' || FLOOR(random()*99999)::int
    ELSE 'https://instagram.com/user' || FLOOR(random()*99999)::int
  END,
  qty,
  GREATEST(FLOOR(st."sellPer1k" / 1000.0 * qty), 1)::int,
  GREATEST(FLOOR(COALESCE(svc."costPer1k", 100) * 1600 / 100000.0 * qty), 1)::int,
  'Completed',
  NOW() - (random() * INTERVAL '90 days')
FROM (
  SELECT i,
    (ARRAY['instagram','instagram','instagram','instagram','instagram','instagram','instagram',
           'tiktok','tiktok','tiktok','tiktok',
           'youtube','youtube','youtube',
           'twitter','twitter',
           'facebook','facebook',
           'telegram',
           'spotify',
           'threads',
           'instagram','tiktok','youtube','twitter'])[FLOOR(random()*25+1)] AS platform,
    (ARRAY[100,200,300,500,1000,1500,2000,2500,3000,5000])[FLOOR(random()*10+1)] AS qty
  FROM generate_series(1, 25200) AS s(i)
) s
CROSS JOIN LATERAL (
  SELECT u.id FROM users u ORDER BY random() LIMIT 1
) u
CROSS JOIN LATERAL (
  SELECT st.id, st."serviceId", st."sellPer1k"
  FROM service_tiers st
  JOIN service_groups sg ON sg.id = st."groupId"
  WHERE LOWER(sg.platform) = s.platform AND st.enabled = true
  ORDER BY random() LIMIT 1
) st
LEFT JOIN services svc ON svc.id = st."serviceId";

-- Step 5: Verify
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'referrals', COUNT(*) FROM users WHERE "referredBy" IS NOT NULL;
