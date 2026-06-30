-- AlterTable
ALTER TABLE "dispatch_images" ADD COLUMN     "image_hash" TEXT,
ADD COLUMN     "ocr_provider" TEXT,
ADD COLUMN     "re_ocr_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ocr_usage_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "dispatch_image_id" TEXT,
    "image_hash" TEXT,
    "status" TEXT NOT NULL,
    "confidence" TEXT,
    "item_count" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_usage_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ocr_usage_logs" ADD CONSTRAINT "ocr_usage_logs_dispatch_image_id_fkey" FOREIGN KEY ("dispatch_image_id") REFERENCES "dispatch_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
