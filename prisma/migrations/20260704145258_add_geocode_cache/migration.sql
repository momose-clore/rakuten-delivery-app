-- D①: ジオコーディング結果キャッシュ（同一住所の再変換を避け Google 呼び出しを削減）
-- キー = 正規化住所（buildLookupKey）。氏名/電話/伝票No は保存しない（住所キーと座標のみ）。
CREATE TABLE "geocode_cache" (
    "address_key" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location_type" TEXT,
    "source" TEXT NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("address_key")
);
