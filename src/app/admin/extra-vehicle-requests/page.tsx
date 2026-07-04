import { requireAdmin } from "@/lib/auth/permissions";
import { ExtraVehicleAdminClient } from "@/components/extra-vehicle/ExtraVehicleAdminClient";

export default async function ExtraVehicleRequestsPage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">増便申請</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理者・ドライバーからの増便申請を確認し、承認／却下します。申請はCARIOが取得し、CARIO公式LINEから専用グループへ指定フォーマットで報告します（本文はコピーして手動報告も可）。
        </p>
      </div>

      <ExtraVehicleAdminClient />
    </div>
  );
}
