-- クルー機能 Phase B-1: 誤配なし確認 + 倉庫到着/終了報告

-- delivery_items: 誤配なし確認
ALTER TABLE "delivery_items"
  ADD COLUMN IF NOT EXISTS "no_misdelivery"    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "no_misdelivery_at" TIMESTAMPTZ;

-- driver_day_reports: 倉庫到着時刻・終了報告（1ドライバー・1日）
CREATE TABLE IF NOT EXISTS "driver_day_reports" (
  "id"                   TEXT        NOT NULL,
  "driver_id"            TEXT        NOT NULL,
  "work_date"            DATE        NOT NULL,
  "warehouse_arrival_at" TIMESTAMPTZ,
  "finished_reported_at" TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_day_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "driver_day_reports_driver_id_work_date_key"
  ON "driver_day_reports" ("driver_id", "work_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'driver_day_reports_driver_id_fkey'
  ) THEN
    ALTER TABLE "driver_day_reports"
      ADD CONSTRAINT "driver_day_reports_driver_id_fkey"
      FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
