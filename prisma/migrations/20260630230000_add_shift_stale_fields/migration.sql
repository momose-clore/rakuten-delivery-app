-- AlterTable shifts: CARIO stale 状態管理カラム追加（v4.1）
ALTER TABLE "shifts"
  ADD COLUMN IF NOT EXISTS "is_stale"      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "source_status" TEXT    DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS "imported_at"   TIMESTAMPTZ;
