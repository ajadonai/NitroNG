-- Add customActions column to admins table
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "customActions" TEXT;
