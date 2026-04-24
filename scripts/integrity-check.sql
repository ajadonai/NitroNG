-- ══════════════════════════════════════
-- NITRO DATA INTEGRITY CHECK
-- Paste each query into Neon SQL Editor
-- ══════════════════════════════════════


-- 1. BALANCE vs TRANSACTION HISTORY
-- Shows users where DB balance doesn't match sum of transactions
-- Any rows = money leak
SELECT 
  u.name,
  u.email,
  u.balance / 100.0 AS "db_balance_naira",
  COALESCE(SUM(t.amount), 0) / 100.0 AS "calculated_naira",
  (u.balance - COALESCE(SUM(t.amount), 0)) / 100.0 AS "diff_naira"
FROM users u
LEFT JOIN transactions t ON t."userId" = u.id AND t.status = 'Completed'
WHERE u."deletedAt" IS NULL
GROUP BY u.id, u.name, u.email, u.balance
HAVING ABS(u.balance - COALESCE(SUM(t.amount), 0)) > 1
ORDER BY ABS(u.balance - COALESCE(SUM(t.amount), 0)) DESC;


-- 2. NEGATIVE BALANCES
-- Should return 0 rows
SELECT name, email, balance / 100.0 AS "balance_naira"
FROM users
WHERE balance < 0 AND "deletedAt" IS NULL;


-- 3. ORDERS WITHOUT MATCHING TRANSACTION
-- Active orders that have no debit transaction (money taken but not logged)
SELECT o."orderId", o.status, o.charge / 100.0 AS "charge_naira", o."createdAt"
FROM orders o
WHERE o."deletedAt" IS NULL
  AND o.status != 'Cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t."userId" = o."userId"
      AND t.reference = o."orderId"
      AND t.type = 'order'
  )
ORDER BY o."createdAt" DESC
LIMIT 20;


-- 4. CANCELLED ORDERS WITHOUT REFUNDS
-- Orders that were charged then cancelled but never refunded
SELECT o."orderId", o.charge / 100.0 AS "charge_naira", o."createdAt"
FROM orders o
WHERE o."deletedAt" IS NULL
  AND o.status = 'Cancelled'
  AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE t."userId" = o."userId"
      AND t.reference = o."orderId"
      AND t.type = 'order'
  )
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t."userId" = o."userId"
      AND t.type = 'refund'
      AND t.reference LIKE '%' || o."orderId" || '%'
  )
ORDER BY o."createdAt" DESC;


-- 5. DUPLICATE DEPOSITS
-- Same reference credited more than once
SELECT reference, COUNT(*) AS times, SUM(amount) / 100.0 AS "total_naira"
FROM transactions
WHERE type = 'deposit' AND status = 'Completed' AND reference IS NOT NULL
GROUP BY reference
HAVING COUNT(*) > 1;


-- 6. STALE ORDERS (>24h stuck in Processing/Pending)
SELECT 
  "orderId", 
  status, 
  charge / 100.0 AS "charge_naira",
  "createdAt",
  ROUND(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600) AS "hours_old"
FROM orders
WHERE status IN ('Processing', 'Pending')
  AND "deletedAt" IS NULL
  AND "createdAt" < NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" ASC
LIMIT 20;


-- 7. PLATFORM STATS
SELECT
  (SELECT COUNT(*) FROM users WHERE "deletedAt" IS NULL) AS total_users,
  (SELECT COUNT(*) FROM users WHERE "deletedAt" IS NULL AND "emailVerified" = true) AS verified_users,
  (SELECT COUNT(*) FROM orders WHERE "deletedAt" IS NULL) AS total_orders,
  (SELECT COUNT(*) FROM orders WHERE "deletedAt" IS NULL AND status = 'Completed') AS completed_orders,
  (SELECT COUNT(*) FROM orders WHERE "deletedAt" IS NULL AND status = 'Cancelled') AS cancelled_orders,
  (SELECT COALESCE(SUM(amount), 0) / 100.0 FROM transactions WHERE type = 'deposit' AND status = 'Completed') AS total_deposits_naira,
  (SELECT COALESCE(SUM(charge), 0) / 100.0 FROM orders WHERE "deletedAt" IS NULL AND status != 'Cancelled') AS total_revenue_naira,
  (SELECT COALESCE(SUM(cost), 0) / 100.0 FROM orders WHERE "deletedAt" IS NULL AND status != 'Cancelled') AS total_cost_naira,
  (SELECT COALESCE(SUM(charge - cost), 0) / 100.0 FROM orders WHERE "deletedAt" IS NULL AND status != 'Cancelled') AS total_profit_naira;
