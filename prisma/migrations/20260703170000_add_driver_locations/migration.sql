-- ドライバー現在地（GPS リアルタイム表示用）
-- 1ドライバー1行。現在地を upsert で更新（履歴は持たない）。
CREATE TABLE "driver_locations" (
    "driver_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("driver_id")
);
