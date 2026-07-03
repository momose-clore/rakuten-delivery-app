"use client";

import { useState } from "react";
import Link from "next/link";
import type { DriverProgress, DeliveryProgress } from "@/types/progress";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ASSIGNED:      { label: "未完了",     className: "bg-blue-100 text-blue-700" },
  IN_DELIVERY:   { label: "配送中",     className: "bg-blue-100 text-blue-700" },
  COMPLETED:     { label: "完了",       className: "bg-green-100 text-green-700" },
  ABSENT:        { label: "不在",       className: "bg-orange-100 text-orange-700" },
  RETURNED:      { label: "持戻り",     className: "bg-red-100 text-red-700" },
  SKIPPED:       { label: "スキップ",   className: "bg-gray-100 text-gray-500" },
  ADDRESS_ERROR: { label: "住所エラー", className: "bg-red-50 text-red-500" },
};

interface Props {
  driver: DriverProgress;
  date: string;
}

export function ProgressDriverCard({ driver, date }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeliveryProgress[]>([]);
  const [loading, setLoading] = useState(false);

  const completionRate = driver.totalCount > 0
    ? Math.round((driver.completedCount / driver.totalCount) * 100)
    : 0;

  const hasAlert = driver.absentCount > 0 || driver.returnedCount > 0;

  async function toggleDetail() {
    if (!open && items.length === 0) {
      setLoading(true);
      const res = await fetch(`/api/admin/progress/${driver.driverId}?date=${date}`);
      if (res.ok) {
        const body = await res.json();
        setItems(body.items ?? []);
      }
      setLoading(false);
    }
    setOpen((v) => !v);
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${hasAlert ? "border-orange-300" : "border-gray-200"}`}>
      {/* カードヘッダー */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{driver.driverName}</span>
            <span className="text-xs text-gray-500">{driver.companyName ?? "—"}</span>
            <span className="text-xs text-gray-500">{driver.area ?? "—"}</span>
          </div>
          {driver.lastUpdatedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              最終更新: {new Date(driver.lastUpdatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* 進捗バー */}
        <div className="w-24 shrink-0">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{driver.completedCount}/{driver.totalCount}</span>
            <span>{completionRate}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleDetail}
            className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          >
            {open ? "閉じる" : "詳細"}
          </button>
          <Link
            href={`/admin/progress/${driver.driverId}?date=${date}`}
            className="text-xs px-2 py-1 border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
          >
            個別ページ
          </Link>
        </div>
      </div>

      {/* ステータス集計 */}
      <div className="px-4 pb-3 flex flex-wrap gap-2">
        {driver.inProgressCount > 0 && (
          <Chip label={`未完了 ${driver.inProgressCount}`} color="bg-blue-50 text-blue-700" />
        )}
        {driver.completedCount > 0 && (
          <Chip label={`完了 ${driver.completedCount}`} color="bg-green-50 text-green-700" />
        )}
        {driver.absentCount > 0 && (
          <Chip label={`不在 ${driver.absentCount}`} color="bg-orange-100 text-orange-700" />
        )}
        {driver.returnedCount > 0 && (
          <Chip label={`持戻り ${driver.returnedCount}`} color="bg-red-100 text-red-700" />
        )}
        {driver.skippedCount > 0 && (
          <Chip label={`スキップ ${driver.skippedCount}`} color="bg-gray-100 text-gray-500" />
        )}
      </div>

      {/* 詳細テーブル */}
      {open && (
        <div className="border-t border-gray-100">
          {loading ? (
            <p className="text-xs text-gray-400 px-4 py-3">読み込み中...</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {["順", "配車No", "W番号", "住所", "数量", "ステータス", "更新"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const sc = STATUS_CONFIG[item.deliveryStatus] ?? STATUS_CONFIG.ASSIGNED;
                  return (
                    <tr key={item.deliveryItemId} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-bold text-gray-700">{item.routeOrder ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{item.dispatchKey ?? "—"}</td>
                      <td className="px-3 py-2">{item.waveNo ?? "—"}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate text-gray-700">{item.address ?? "—"}</td>
                      <td className="px-3 py-2">{item.totalCount ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sc.className}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {new Date(item.updatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
  );
}
