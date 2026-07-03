-- 増便申請テーブル（管理者・ドライバー双方が申請 / 後でCARIO連携）
-- 既存データを壊さないよう IF NOT EXISTS で追加のみ
CREATE TABLE IF NOT EXISTS "extra_vehicle_requests" (
  "id"                    TEXT        NOT NULL,
  "request_date"          DATE        NOT NULL,
  "depot"                 TEXT        NOT NULL,
  "wave_no"               TEXT        NOT NULL,
  "vehicle_count"         INTEGER     NOT NULL DEFAULT 1,
  "assigned_driver_name"  TEXT,
  "reason"                TEXT        NOT NULL,
  "status"                TEXT        NOT NULL DEFAULT 'pending',
  "created_by_user_id"    TEXT        NOT NULL,
  "created_by_role"       TEXT        NOT NULL,
  "created_by_name"       TEXT,
  "approved_by_user_id"   TEXT,
  "approved_at"           TIMESTAMPTZ,
  "rejected_reason"       TEXT,
  "cario_sync_status"     TEXT        NOT NULL DEFAULT 'not_sent',
  "cario_sent_at"         TIMESTAMPTZ,
  "cario_request_id"      TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extra_vehicle_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extra_vehicle_requests_status_idx"
  ON "extra_vehicle_requests"("status");
CREATE INDEX IF NOT EXISTS "extra_vehicle_requests_request_date_idx"
  ON "extra_vehicle_requests"("request_date");
