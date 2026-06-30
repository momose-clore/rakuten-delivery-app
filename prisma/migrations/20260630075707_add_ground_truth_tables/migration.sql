-- CreateTable
CREATE TABLE "ocr_ground_truth_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dispatch_image_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_ground_truth_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_ground_truth_items" (
    "id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "dispatch_key" TEXT,
    "invoice_no" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "address" TEXT,
    "normal_oricon_count" INTEGER,
    "cooler_box_count" INTEGER,
    "case_count" INTEGER,
    "total_count" INTEGER,

    CONSTRAINT "ocr_ground_truth_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ocr_ground_truth_items" ADD CONSTRAINT "ocr_ground_truth_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "ocr_ground_truth_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
