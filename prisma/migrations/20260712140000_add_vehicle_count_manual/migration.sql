-- 台数確認表の手動入力値（現状は SP のみ）。純粋 additive（既存テーブル非変更）。
-- 貼付=通常稼働・増車=フォロー は実績から自動集計するが、SP は判別データが無いため手入力する。

-- CreateTable
CREATE TABLE "vehicle_count_manual" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wave_no" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_count_manual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_count_manual_date_idx" ON "vehicle_count_manual"("date");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_count_manual_date_wave_no_category_key" ON "vehicle_count_manual"("date", "wave_no", "category");
