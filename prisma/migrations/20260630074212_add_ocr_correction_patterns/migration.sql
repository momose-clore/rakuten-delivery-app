-- CreateTable
CREATE TABLE "ocr_correction_patterns" (
    "id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "before_value" TEXT NOT NULL,
    "after_value" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL DEFAULT 'exact',
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_correction_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ocr_correction_patterns_field_name_before_value_key" ON "ocr_correction_patterns"("field_name", "before_value");
