import { redirect } from "next/navigation";

// /admin（末尾なし）で開いたときにダッシュボードへ誘導（indexページ不在の404を解消）
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
