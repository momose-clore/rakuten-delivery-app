-- フォロー（応援）: 二重ハンドラ。元ドライバーを残したまま別ドライバーが配送を手伝う

CREATE TABLE IF NOT EXISTS "delivery_follows" (
  "id"               TEXT        NOT NULL,
  "delivery_item_id" TEXT        NOT NULL,
  "driver_id"        TEXT        NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_follows_delivery_item_id_driver_id_key"
  ON "delivery_follows" ("delivery_item_id", "driver_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'delivery_follows_delivery_item_id_fkey') THEN
    ALTER TABLE "delivery_follows" ADD CONSTRAINT "delivery_follows_delivery_item_id_fkey"
      FOREIGN KEY ("delivery_item_id") REFERENCES "delivery_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'delivery_follows_driver_id_fkey') THEN
    ALTER TABLE "delivery_follows" ADD CONSTRAINT "delivery_follows_driver_id_fkey"
      FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
