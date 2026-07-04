import { requireAdmin } from "@/lib/auth/permissions";
import { AdminDashboardClient } from "@/components/admin/dashboard/AdminDashboardClient";

// 本番ダッシュボード（α の /admin-preview レイアウトを実データで本採用）
export default async function DashboardPage() {
  await requireAdmin();
  return <AdminDashboardClient />;
}
