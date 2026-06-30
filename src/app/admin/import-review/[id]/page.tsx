/** 取込確認詳細（/admin/ocr-review/[id] にリダイレクト・互換性維持） */
import { redirect } from "next/navigation";
interface Props { params: Promise<{ id: string }> }
export default async function ImportReviewDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/ocr-review/${id}`);
}
