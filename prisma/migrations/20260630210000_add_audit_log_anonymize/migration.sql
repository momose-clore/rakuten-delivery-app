-- AlterTable audit_logs: 個人情報匿名化カラム追加（v4.1）
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "target_id_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "field_name"     TEXT,
  ADD COLUMN IF NOT EXISTS "source"         TEXT,
  ADD COLUMN IF NOT EXISTS "status"         TEXT,
  ADD COLUMN IF NOT EXISTS "reason"         TEXT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"     ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_field_name_idx" ON "audit_logs"("field_name");
