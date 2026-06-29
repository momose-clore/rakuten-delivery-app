import { ProgressClient } from "@/components/admin/progress/ProgressClient";

export default function ProgressPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">配送進捗</h1>
        <p className="mt-1 text-sm text-gray-500">
          ドライバー別の配送進捗をリアルタイムに確認します
        </p>
      </div>
      <ProgressClient />
    </div>
  );
}
