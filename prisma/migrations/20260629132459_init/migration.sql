-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DRIVER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'ABSENT');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW_REQUIRED', 'CONFIRMED', 'ERROR');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING_OCR', 'REVIEW_REQUIRED', 'ADDRESS_ERROR', 'UNASSIGNED', 'ASSIGNED', 'IN_DELIVERY', 'COMPLETED', 'ABSENT', 'RETURNED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_DELIVERY', 'COMPLETED', 'ABSENT', 'RETURNED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LoadingMode" AS ENUM ('SIMULTANEOUS', 'SPLIT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "cario_driver_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "company_name" TEXT,
    "area" TEXT,
    "vehicle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "status" "ShiftStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_images" (
    "id" TEXT NOT NULL,
    "delivery_date" DATE NOT NULL,
    "area" TEXT,
    "wave_no" TEXT,
    "image_url" TEXT NOT NULL,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_items" (
    "id" TEXT NOT NULL,
    "dispatch_image_id" TEXT NOT NULL,
    "dispatch_key" TEXT,
    "wave_no" TEXT,
    "vehicle_no" TEXT,
    "delivery_seq" INTEGER,
    "invoice_no" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "address" TEXT,
    "special_flag" TEXT,
    "normal_oricon_count" INTEGER DEFAULT 0,
    "cooler_box_count" INTEGER DEFAULT 0,
    "case_count" INTEGER DEFAULT 0,
    "total_count" INTEGER DEFAULT 0,
    "memo" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "ocr_notes" TEXT,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING_OCR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "delivery_item_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "route_order" INTEGER,
    "wave_no" TEXT,
    "loading_group" TEXT,
    "is_split_loading" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_groups" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "delivery_date" DATE NOT NULL,
    "wave_group" TEXT NOT NULL,
    "loading_mode" "LoadingMode" NOT NULL DEFAULT 'SIMULTANEOUS',
    "start_location" TEXT,
    "end_location" TEXT,
    "return_to_warehouse" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_cario_driver_id_key" ON "drivers"("cario_driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_driver_id_work_date_key" ON "shifts"("driver_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_delivery_item_id_key" ON "assignments"("delivery_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_groups_driver_id_delivery_date_wave_group_key" ON "route_groups"("driver_id", "delivery_date", "wave_group");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_dispatch_image_id_fkey" FOREIGN KEY ("dispatch_image_id") REFERENCES "dispatch_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_delivery_item_id_fkey" FOREIGN KEY ("delivery_item_id") REFERENCES "delivery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_groups" ADD CONSTRAINT "route_groups_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
