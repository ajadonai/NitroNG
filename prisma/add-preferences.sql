-- Add theme and perPage preferences to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS "themePreference" TEXT DEFAULT 'auto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "perPagePreference" INTEGER DEFAULT 10;

-- Add theme preference to admins
ALTER TABLE admins ADD COLUMN IF NOT EXISTS "themePreference" TEXT DEFAULT 'auto';
