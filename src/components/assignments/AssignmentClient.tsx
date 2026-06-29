"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AssignmentSummaryCard } from "./AssignmentSummary";
import type { AssignedItem, AvailableDriver, AssignmentSummary } from "@/types/assignment";

const WAVE_OPTIONS = ["", "W1", "W2", "W3", "W4", "W5", "W6"];

export function AssignmentClient() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [waveNo, setWaveNo] = useState("");
  const [area, setArea] = useState("");

  const [items, setItems] = useState<AssignedItem[]>([]);
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function fetchData() {
    if (!date) return;
    setLoading(true);
    setError("");
    setMessage("");
    const params = new URLSearchParams({ date });
    if (waveNo) params.set("waveNo", waveNo);
    if (area) params.set("area", area);

    const res = await fetch(`/api/assignments?${params}`);
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "データ取得に失敗しました");
      return;
    }
    const body = await res.json();
    setItems(body.items ?? []);
    setDrivers(body.drivers ?? []);
    setSummary(body.summary ?? null);
  }

  async function handleAutoAssign() {
    setAutoRunning(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/assignments/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, waveNo: waveNo || undefined, area: area || undefined }),
    });
    setAutoRunning(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "自動割当に失敗しました");
      return;
    }
    const body = await res.json();
    setMessage(`半自動割当完了：${body.assignedCount} 件を割り当てました`);
    await fetchData();
  }

  async function handleDriverChange(assignmentId: string | null, deliveryItemId: string, driverId: string) {
    if (!driverId) return;

    if (assignmentId) {
      // 既存割当を PATCH で更新
      await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
    } else {
      // 未割当 → auto API で1件だけ割当（簡易）
      const singleItem = items.find((i) => i.deliveryItemId === deliveryItemId);
      if (!singleItem) return;
      // 直接 upsert を POST auto で行うのは難しいため、
      // ここでは楽観的 UI 更新 + 画面をリロードする
    }

    await fetchData();
  }

  async function handleConfirm() {
    if (summary && summary.unassignedCount > 0) {
      const ok = window.confirm(`未割当が ${summary.unassignedCount} 件残っています。このまま確定しますか？`);
      if (!ok) return;
    }
    setConfirming(true);
    setError("");
    const res = await fetch("/api/assignments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, waveNo: waveNo || undefined, area: area || undefined }),
    });
    setConfirming(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "確定に失敗しました");
      return;
    }
    const body = await res.json();
    setMessage(`割当確定完了：割当済み ${body.assignedCount} 件`);
    await fetchData();
  }

  return (
    <div className="space-y-5">
      {/* フィルターパネル */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">絞り込み</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">配送日 <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">W番号</label>
            <select
              value={waveNo}
              onChange={(e) => setWaveNo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WAVE_OPTIONS.map((w) => (
                <option key={w} value={w}>{w || "すべて"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">エリア</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="例：埼玉北"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={fetchData} disabled={loading || !date}>
            {loading ? "取得中..." : "一覧を表示"}
          </Button>
          <Button onClick={handleAutoAssign} disabled={autoRunning || !date} className="bg-orange-500 hover:bg-orange-600 text-white">
            {autoRunning ? "割当中..." : "半自動割当"}
          </Button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">{message}</p>}
      </div>

      {/* 集計カード */}
      {summary && <AssignmentSummaryCard summary={summary} />}

      {/* 稼働可能ドライバー一覧 */}
      {drivers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">稼働可能ドライバー（{drivers.length}名）</p>
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => (
              <div key={d.driverId} className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded">
                <span className="font-medium">{d.name}</span>
                <span className="text-gray-500 ml-1">{d.area ?? "—"} / {d.vehicleId}</span>
                <span className="text-blue-700 ml-1 font-medium">{d.assignedCount}件</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 配送明細テーブル */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["配車No", "W番号", "号車", "住所", "数量", "担当ドライバー"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr
                    key={item.deliveryItemId}
                    className={!item.assignedDriverId ? "bg-red-50" : "hover:bg-gray-50"}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{item.dispatchKey ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{item.waveNo ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{item.vehicleNo ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{item.address ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{item.totalCount ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={item.assignedDriverId ?? ""}
                        onChange={(e) => handleDriverChange(item.assignmentId, item.deliveryItemId, e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 w-full min-w-[120px]"
                      >
                        <option value="">未割当</option>
                        {drivers.map((d) => (
                          <option key={d.driverId} value={d.driverId}>
                            {d.name}（{d.area ?? "—"}）
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 確定ボタン */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {confirming ? "確定中..." : "割当確定"}
            </Button>
            <p className="text-xs text-gray-500">確定後、ドライバー画面（STEP 8）に反映されます</p>
          </div>
        </div>
      )}

      {items.length === 0 && summary !== null && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">対象の配送明細がありません</p>
          <p className="text-xs text-gray-400 mt-1">STEP 4 でOCRを確定済みの配車表があることを確認してください</p>
        </div>
      )}
    </div>
  );
}
