import { LocationOverrideClient } from "@/components/location/LocationOverrideClient";

export default function LocationOverridesPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">住所補正管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          手動ピン修正・入口メモ・建物メモを管理します（GODOOR・ゼンリン不使用）
        </p>
      </div>
      <LocationOverrideClient />
    </div>
  );
}
