"use client";

import { useState } from "react";

interface MemoFields {
  entranceMemo: string;
  buildingMemo: string;
  nameplateMemo: string;
  parkingMemo: string;
  cautionMemo: string;
}

const EMPTY: MemoFields = {
  entranceMemo: "",
  buildingMemo: "",
  nameplateMemo: "",
  parkingMemo: "",
  cautionMemo: "",
};

const FIELDS: { key: keyof MemoFields; label: string; icon: string; placeholder: string }[] = [
  { key: "entranceMemo",  label: "入口",  icon: "🚪", placeholder: "例: 建物裏の階段から" },
  { key: "buildingMemo",  label: "建物",  icon: "🏢", placeholder: "例: 3階建てアパート左手前" },
  { key: "nameplateMemo", label: "表札",  icon: "📋", placeholder: "例: 表札は「山」ではじまる" },
  { key: "parkingMemo",   label: "駐車",  icon: "🅿️", placeholder: "例: 前面道路に一時停車可" },
  { key: "cautionMemo",   label: "注意",  icon: "⚠️", placeholder: "例: 犬に注意 / インターホン故障" },
];

/**
 * ドライバーが配送メモ（入口/建物/表札/駐車/注意）を申請するフォーム。
 * POST /api/driver/location-overrides に PENDING 登録し、管理者承認後に反映される。
 */
export function LocationMemoForm({
  deliveryItemId,
  address,
}: {
  deliveryItemId: string;
  address: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<MemoFields>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasAnyInput = Object.values(fields).some((v) => v.trim() !== "");

  async function handleSubmit() {
    if (!address) {
      setError("住所が未登録のため申請できません");
      return;
    }
    if (!hasAnyInput) {
      setError("メモを1つ以上入力してください");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");

    const payload: Record<string, string> = { deliveryItemId, address };
    for (const { key } of FIELDS) {
      const v = fields[key].trim();
      if (v) payload[key] = v;
    }

    const res = await fetch("/api/driver/location-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "申請に失敗しました");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setMessage(body.message ?? "申請しました。管理者確認後に反映されます。");
    setFields(EMPTY);
    setOpen(false);
  }

  return (
    <div className="border-t border-gray-100 pt-2">
      {!open && (
        <button
          onClick={() => { setOpen(true); setMessage(""); setError(""); }}
          className="w-full py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300"
        >
          ＋ 配送メモを申請（入口・駐車・注意など）
        </button>
      )}

      {message && (
        <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">{message}</p>
      )}

      {open && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            気づいた点を入力して申請してください。管理者が確認後に配送先へ反映されます。
          </p>
          {FIELDS.map(({ key, label, icon, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-500">{icon} {label}</label>
              <input
                type="text"
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !hasAnyInput}
              className="flex-1 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "申請中..." : "申請する"}
            </button>
            <button
              onClick={() => { setOpen(false); setFields(EMPTY); setError(""); }}
              disabled={submitting}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
