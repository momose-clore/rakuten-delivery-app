-- 配達完了時刻（確定値）。COMPLETED になった時刻を記録し、以後の編集で動かない。
-- wave別完了時刻・実績の正典。既存行は NULL（過去分は crew-reports が updatedAt で代替）。
ALTER TABLE "delivery_items" ADD COLUMN "delivered_at" TIMESTAMP(3);
