-- 当日の号車配置（号車→ドライバー・日替わり）。純粋 additive（既存テーブル非変更）。
-- ※ prisma migrate dev が生成したドリフト補正(他テーブルのALTER/SET NOT NULL等)は
--    本番破壊リスクがあるため除去し、本テーブル作成のみに限定した（γ・2026-07-06）。

-- CreateTable
CREATE TABLE "vehicle_rosters" (
    "id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "vehicle_no" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_rosters_work_date_idx" ON "vehicle_rosters"("work_date");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_rosters_work_date_vehicle_no_key" ON "vehicle_rosters"("work_date", "vehicle_no");
