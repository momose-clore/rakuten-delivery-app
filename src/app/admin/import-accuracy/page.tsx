import { ImportAccuracyClient } from "@/components/import-accuracy/ImportAccuracyClient";

export default function ImportAccuracyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">取込精度レポート</h1>
        <p className="mt-1 text-sm text-gray-500">
          delivery_items から毎回再集計した OCR 取込の精度指標です（確定 / 自動救済 / 要確認の割合）
        </p>
      </div>
      <ImportAccuracyClient />
    </div>
  );
}
