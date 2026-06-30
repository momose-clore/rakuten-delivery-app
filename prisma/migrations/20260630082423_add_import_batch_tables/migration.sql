-- CreateTable
CREATE TABLE "dispatch_import_batches" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "original_file_url" TEXT,
    "normalized_json_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "high_count" INTEGER NOT NULL DEFAULT 0,
    "medium_count" INTEGER NOT NULL DEFAULT 0,
    "low_count" INTEGER NOT NULL DEFAULT 0,
    "auto_rescued_count" INTEGER NOT NULL DEFAULT 0,
    "needs_review_count" INTEGER NOT NULL DEFAULT 0,
    "quality_score" INTEGER,
    "quality_level" TEXT,
    "capture_mode" TEXT,
    "layout_profile" TEXT,
    "depot_name" TEXT,
    "wave_no" TEXT,
    "vehicle_no" TEXT,
    "delivery_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_import_rows" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "delivery_item_id" TEXT,
    "row_no" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_import_rows_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dispatch_import_rows" ADD CONSTRAINT "dispatch_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "dispatch_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
