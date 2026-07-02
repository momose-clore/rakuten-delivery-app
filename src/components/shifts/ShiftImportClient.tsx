"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShiftSummaryCard } from "./ShiftSummaryCard";
import { CarioConnectionBanner } from "./CarioConnectionBanner";
import type { CarioConnectionDisplay, DriverWithShift, ShiftImportResult } from "@/types/shift";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "確定",     className: "bg-green-100 text-green-700" },
  TENTATIVE: { label: "仮シフト", className: "bg-orange-100 text-orange-700" },
  ABSENT:    { label: "不在",     className: "bg-gray-100 text-gray-500" },
};

export function ShiftImportClient() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ShiftImportResult | null>(null);
  const [drivers, setDrivers] = useState<DriverWithShift[]>([]);
  const [connection, setConnection] = useState<CarioConnectionDisplay | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  async function handleImport() {
    setImporting(true);
    setError("");

    const res = await fetch("/api/shifts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });

    setImporting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "取込に失敗しました");
      // API 失敗時は前回取込データ（stale）を再取得して警告バナーを表示する
      await fetchShifts(date);
      return;
    }

    const body = await res.json();
    const summary = body.summary;

    // 取込後にリストを取得
    await fetchShifts(date, summary);
  }

  async function handleApproveStale() {
    setApproving(true);
    setError("");
    const res = await fetch("/api/shifts/approve-stale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    setApproving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "承認に失敗しました");
      return;
    }
    // 承認後の状態を反映するため再取得
    await fetchShifts(date);
  }

  interface ImportSummaryInput {
    driverUpserted: number;
    shiftUpserted: number;
    confirmedCount: number;
    tentativeCount: number;
    companyBreakdown: Record<string, number>;
    areaBreakdown: Record<string, number>;
  }

  async function fetchShifts(targetDate: string, summary?: ImportSummaryInput) {
    setLoading(true);
    const res = await fetch(`/api/shifts?date=${targetDate}`);
    setLoading(false);

    if (!res.ok) {
      setError("一覧取得に失敗しました");
      return;
    }

    const body = await res.json();
    setDrivers(body.drivers ?? []);
    setConnection(body.connection ?? null);

    if (summary) {
      setResult({
        date: targetDate,
        driverUpserted: summary.driverUpserted,
        shiftUpserted: summary.shiftUpserted,
        confirmedCount: body.summary.confirmedCount,
        tentativeCount: body.summary.tentativeCount,
        absentCount: 0,
        companyBreakdown: body.summary.companyBreakdown,
        areaBreakdown: body.summary.areaBreakdown,
        drivers: body.drivers,
      });
    }
  }

  async function handleDateChange(newDate: string) {
    setDate(newDate);
    setResult(null);
    setDrivers([]);
    setConnection(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      {/* 日付選択・取込ボタン */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">CARIOシフト取込</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象日</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={handleImport} disabled={importing || !date}>
            {importing ? "取込中..." : "CARIOシフト取込"}
          </Button>
          <Button
            onClick={() => fetchShifts(date)}
            disabled={loading || !date}
            className="bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            {loading ? "取得中..." : "一覧を表示"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
        )}
      </div>

      {/* CARIO 接続状態バナー */}
      {connection && (
        <CarioConnectionBanner
          connection={connection}
          onApproveStale={handleApproveStale}
          approving={approving}
        />
      )}

      {/* サマリーカード */}
      {result && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            取込完了：ドライバー {result.driverUpserted} 件、シフト {result.shiftUpserted} 件
          </p>
          <ShiftSummaryCard
            total={result.driverUpserted}
            confirmedCount={result.confirmedCount}
            tentativeCount={result.tentativeCount}
            companyBreakdown={result.companyBreakdown}
            areaBreakdown={result.areaBreakdown}
          />
        </div>
      )}

      {/* ドライバー一覧 */}
      {drivers.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            稼働予定ドライバー一覧（{drivers.length} 人）
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["氏名", "所属会社", "担当エリア", "車両", "開始", "終了", "状態"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.map((d) => {
                  const st = STATUS_LABEL[d.status] ?? STATUS_LABEL.ABSENT;
                  return (
                    <tr key={d.shiftId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                      <td className="px-4 py-3 text-gray-700">{d.companyName ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{d.area ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{d.vehicleId ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{d.startTime ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{d.endTime ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${st.className}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drivers.length === 0 && result && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">対象日のシフトデータがありません</p>
        </div>
      )}
    </div>
  );
}
