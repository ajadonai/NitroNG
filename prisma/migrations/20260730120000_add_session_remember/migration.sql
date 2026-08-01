-- AlterTable
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "remember" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "admin_sessions" ADD COLUMN IF NOT EXISTS "remember" BOOLEAN NOT NULL DEFAULT false;
