-- AlterTable delivery_items: 予測値・推定値管理カラム追加
ALTER TABLE "delivery_items"
  ADD COLUMN IF NOT EXISTS "coordinate_source"        TEXT,
  ADD COLUMN IF NOT EXISTS "coordinate_status"        TEXT DEFAULT 'ESTIMATED',
  ADD COLUMN IF NOT EXISTS "coordinate_confidence"    TEXT,
  ADD COLUMN IF NOT EXISTS "field_source_json"        TEXT,
  ADD COLUMN IF NOT EXISTS "field_status_json"        TEXT,
  ADD COLUMN IF NOT EXISTS "prediction_warnings_json" TEXT;

-- AlterTable delivery_location_overrides: マッチ精度・適用元カラム追加
ALTER TABLE "delivery_location_overrides"
  ADD COLUMN IF NOT EXISTS "match_confidence" TEXT,
  ADD COLUMN IF NOT EXISTS "applied_from"     TEXT;
