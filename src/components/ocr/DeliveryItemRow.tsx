"use client";

import { useState } from "react";
import type { DeliveryItem } from "@/types/dispatch";
import { ReviewReasonBadge, parseReviewReasons, rowHighlight } from "./ReviewReasonBadge";

interface DeliveryItemRowProps {
  item: DeliveryItem;
  dispatchImageId: string;
  onSaved: (updated: DeliveryItem) => void;
}

type EditState = Partial<Pick<
  DeliveryItem,
  "dispatchKey" | "invoiceNo" | "customerName" | "customerPhone" |
  "address" | "specialFlag" | "normalOriconCount" | "coolerBoxCount" |
  "caseCount" | "totalCount" | "memo"
>>;

export function DeliveryItemRow({ item, dispatchImageId, onSaved }: DeliveryItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditState>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const reasons = parseReviewReasons(item.ocrNotes);
  const highlight = rowHighlight(reasons);

  function startEdit() {
    setDraft({
      dispatchKey: item.dispatchKey ?? "",
      invoiceNo: item.invoiceNo ?? "",
      customerName: item.customerName ?? "",
      customerPhone: item.customerPhone ?? "",
      address: item.address ?? "",
      specialFlag: item.specialFlag ?? "",
      normalOriconCount: item.normalOriconCount ?? 0,
      coolerBoxCount: item.coolerBoxCount ?? 0,
      caseCount: item.caseCount ?? 0,
      totalCount: item.totalCount ?? 0,
      memo: item.memo ?? "",
    });
    setEditing(true);
    setSaveError("");
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setSaveError("");
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    const res = await fetch(
      `/api/ocr-review/${dispatchImageId}/items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? "保存に失敗しました");
      return;
    }
    const body = await res.json();
    onSaved(body.deliveryItem);
    setEditing(false);
    setDraft({});
  }

  function field(key: keyof EditState, label: string, type: "text" | "number" = "text") {
    const displayVal = item[key as keyof DeliveryItem];
    if (!editing) {
      return (
        <td className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap max-w-[200px]">
          {displayVal !== null && displayVal !== undefined ? String(displayVal) : <span className="text-gray-300">—</span>}
        </td>
      );
    }
    return (
      <td className="px-3 py-2">
        <input
          type={type}
          aria-label={label}
          value={String(draft[key] ?? "")}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </td>
    );
  }

  return (
    <tr className={`${highlight} transition-colors`}>
      {field("dispatchKey", "配車No")}
      {field("invoiceNo", "伝票No")}
      {field("customerName", "氏名")}
      {field("customerPhone", "電話番号")}
      {field("address", "住所")}
      {field("specialFlag", "特殊フラグ")}
      {field("normalOriconCount", "常温オリコン", "number")}
      {field("coolerBoxCount", "クーラーボックス", "number")}
      {field("caseCount", "ケース", "number")}
      {field("totalCount", "総数", "number")}
      {field("memo", "備考")}
      <td className="px-3 py-2">
        <ReviewReasonBadge reasons={reasons} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {editing ? (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              キャンセル
            </button>
            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            編集
          </button>
        )}
      </td>
    </tr>
  );
}
