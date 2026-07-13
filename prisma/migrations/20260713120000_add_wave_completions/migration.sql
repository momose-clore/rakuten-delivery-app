-- CARIO から pull する「稼働者の終了報告（wave完了）」保持テーブル。純 additive（既存テーブル非変更）。
-- 群LINEの終了報告は CARIO 保持 → 当アプリが pull → 台数確認表の 貼付/増車 に反映（SP は手入力のまま）。

-- CreateTable
CREATE TABLE "wave_completions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wave_no" INTEGER NOT NULL,
    "driver_key" TEXT NOT NULL,
    "driver_id" TEXT,
    "driver_name" TEXT,
    "vehicle_type" TEXT NOT NULL DEFAULT '貼付',
    "completed_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'CARIO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wave_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wave_completions_date_idx" ON "wave_completions"("date");

-- CreateIndex
CREATE INDEX "wave_completions_date_wave_no_idx" ON "wave_completions"("date", "wave_no");
