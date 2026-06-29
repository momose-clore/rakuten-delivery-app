import { RouteClient } from "@/components/routes/RouteClient";

export default function RoutesPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ルート確認</h1>
        <p className="mt-1 text-sm text-gray-500">
          住所を緯度経度化し、配送順を生成します
        </p>
      </div>
      <RouteClient />
    </div>
  );
}
