-- CreateTable
CREATE TABLE "delivery_location_overrides" (
    "id" TEXT NOT NULL,
    "normalized_address" TEXT NOT NULL,
    "postal_code" TEXT,
    "prefecture" TEXT,
    "city" TEXT,
    "town" TEXT,
    "block" TEXT,
    "building_name" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "place_id" TEXT,
    "entrance_memo" TEXT,
    "building_memo" TEXT,
    "nameplate_memo" TEXT,
    "access_memo" TEXT,
    "caution_memo" TEXT,
    "parking_memo" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_location_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_location_overrides_normalized_address_idx" ON "delivery_location_overrides"("normalized_address");
