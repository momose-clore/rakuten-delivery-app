import { ShiftImportClient } from "@/components/shifts/ShiftImportClient";

export default function ShiftsPage() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CARIOシフト取込</h1>
        <p className="mt-1 text-sm text-gray-500">
          対象日を選択してCARIOからシフトデータを取り込みます
        </p>
      </div>
      <ShiftImportClient />
    </div>
  );
}
