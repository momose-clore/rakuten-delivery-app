"use client";

import { useState } from "react";
import { formatProtectedFieldsSummary } from "@/lib/prediction/protection";
import type { ProtectedFieldInfo } from "@/lib/prediction/protection";

interface ReOcrDialogProps {
  dispatchImageId: string;
  protectedFields: ProtectedFieldInfo[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * 再OCRダイアログ
 * - 手動修正済み・承認済みフィールドを一覧表示
 * - これらは再OCRで上書きされないことを説明
 */
export function ReOcrDialog({
  protectedFields,
  onConfirm,
  onCancel,
}: ReOcrDialogProps) {
  const [loading, setLoading] = useState(false);
  const summaries = formatProtectedFieldsSummary(protectedFields);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">再OCRを実行しますか？</h2>

        {summaries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              以下の項目は手動修正済み・管理者承認済みのため、再OCRで<strong>上書きされません</strong>：
            </p>
            <ul className="text-sm space-y-1">
              {summaries.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-green-600">🔒</span>
                  <span className="text-gray-700">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            取込済みの値が再OCRの結果で更新されます。
          </p>
        )}

        <p className="text-xs text-gray-400">
          ※ 再OCRを実行すると、上記以外のフィールドはOCR結果で置き換えられます。
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "実行中..." : "再OCR実行"}
          </button>
        </div>
      </div>
    </div>
  );
}
