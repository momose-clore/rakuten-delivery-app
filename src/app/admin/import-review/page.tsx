/** 取込確認一覧（/admin/ocr-review にリダイレクト・互換性維持） */
import { redirect } from "next/navigation";
export default function ImportReviewPage() {
  redirect("/admin/ocr-review");
}
