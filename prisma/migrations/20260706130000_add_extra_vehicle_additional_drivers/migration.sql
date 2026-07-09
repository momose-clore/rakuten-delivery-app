-- 増便申請に「追加ドライバー」列を追加（JSON文字列。既存データ非破壊・追記のみ）
ALTER TABLE "extra_vehicle_requests"
  ADD COLUMN IF NOT EXISTS "additional_drivers" TEXT;
