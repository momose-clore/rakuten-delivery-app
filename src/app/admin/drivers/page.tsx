import { requireAdmin } from "@/lib/auth/permissions";
import { DriverAdminClient } from "@/components/admin/drivers/DriverAdminClient";

export default async function AdminDriversPage() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ドライバー管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          ドライバーのログインID・パスワード（設定/リセット）・CARIO紐付けを管理します。
        </p>
      </div>
      <DriverAdminClient />
    </div>
  );
}
