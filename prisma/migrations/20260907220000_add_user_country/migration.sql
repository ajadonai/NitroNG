-- Country the user's phone belongs to (ISO 3166-1 alpha-2).
-- Every account that existed before this column was Nigerian by definition:
-- the signup gate rejected anything that was not a +234 number, so the
-- backfill is a statement of fact rather than an assumption.
ALTER TABLE "users" ADD COLUMN "country" TEXT DEFAULT 'NG';
