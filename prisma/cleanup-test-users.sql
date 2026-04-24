-- Nitro: Clean up test/seed users
-- Run in Neon SQL Editor before launch

-- First check what we're deleting
SELECT id, name, email, "emailVerified", "createdAt" 
FROM users 
WHERE email LIKE '%@test%' OR email LIKE '%@example%' OR name LIKE 'Test %' OR name LIKE 'Seed %'
ORDER BY "createdAt";

-- Delete their sessions first (foreign key)
DELETE FROM sessions WHERE "userId" IN (
  SELECT id FROM users WHERE email LIKE '%@test%' OR email LIKE '%@example%' OR name LIKE 'Test %' OR name LIKE 'Seed %'
);

-- Delete their transactions
DELETE FROM transactions WHERE "userId" IN (
  SELECT id FROM users WHERE email LIKE '%@test%' OR email LIKE '%@example%' OR name LIKE 'Test %' OR name LIKE 'Seed %'
);

-- Delete their orders
DELETE FROM orders WHERE "userId" IN (
  SELECT id FROM users WHERE email LIKE '%@test%' OR email LIKE '%@example%' OR name LIKE 'Test %' OR name LIKE 'Seed %'
);

-- Delete their tickets
DELETE FROM tickets WHERE "userId" IN (
  SELECT id FROM users WHERE email LIKE '%@test%' OR email LIKE '%@example%' OR name LIKE 'Test %' OR name LIKE 'Seed %'
);

-- Delete the users
DELETE FROM users WHERE email LIKE '%@test%' OR email LIKE '%@example%' OR name LIKE 'Test %' OR name LIKE 'Seed %';

-- Also clean up unverified users older than 7 days with no orders
DELETE FROM sessions WHERE "userId" IN (
  SELECT id FROM users WHERE "emailVerified" = false AND "createdAt" < NOW() - INTERVAL '7 days'
  AND id NOT IN (SELECT DISTINCT "userId" FROM orders)
);
DELETE FROM users WHERE "emailVerified" = false AND "createdAt" < NOW() - INTERVAL '7 days'
  AND id NOT IN (SELECT DISTINCT "userId" FROM orders);
