"use client";

import { useState, useCallback } from "react";
import { ProgressDriverCard } from "./ProgressDriverCard";
import type { DriverProgress } from "@/types/progress";

const WAVE_OPTIONS = ["", "W1", "W2", "W3", "W4", "W5", "W6"];

export function ProgressClient() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [area, setArea] = useState("");
  const [waveNo, setWaveNo] = useState("");
  const [drivers, setDrivers] = useState<DriverProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastFetched, setLastFetched] = useState("");

  const fetchProgress = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date });
    if (area) params.set("area", area);
    if (waveNo) params.set("waveNo", waveNo);
    const res = await fetch(`/api/admin/progress?${params}`);
    setLoading(false);
    if (!res.ok) { setError("取得に失敗しました"); return; }
    const body = await res.json();
    setDrivers(body.drivers ?? []);
    setLastFetched(new Date().toLocaleTimeString("ja-JP"));
  }, [date, area, waveNo]);

  const totalAssigned = drivers.reduce((s, d) => s + d.totalCount, 0);
  const totalCompleted = drivers.reduce((s, d) => s + d.completedCount, 0);
  const totalAbsent = drivers.reduce((s, d) => s + d.absentCount, 0);
  const totalReturned = drivers.reduce((s, d) => s + d.returnedCount, 0);
  const totalInProgress = drivers.reduce((s, d) => s + d.inProgressCount, 0);

  return (
    <div className="space-y-5">
      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">配送日</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">エリア</label>
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder="例: 埼玉北"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">W番号</label>
          <select value={waveNo} onChange={(e) => setWaveNo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {WAVE_OPTIONS.map((w) => <option key={w} value={w}>{w || "すべて"}</option>)}
          </select>
        </div>
        <button onClick={fetchProgress} disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-50">
          {loading ? "取得中..." : "進捗を表示"}
        </button>
        {lastFetched && (
          <span className="text-xs text-gray-400">最終取得: {lastFetched}</span>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* 集計サマリー */}
      {drivers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <SumCard label="対象ドライバー" value={drivers.length} unit="名" />
          <SumCard label="未完了" value={totalInProgress} unit="件" highlight />
          <SumCard label="完了" value={totalCompleted} unit="件" green />
          <SumCard label="不在" value={totalAbsent} unit="件" orange />
          <SumCard label="持戻り" value={totalReturned} unit="件" red />
        </div>
      )}

      {/* 全体進捗バー */}
      {totalAssigned > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>全体進捗</span>
            <span>{totalCompleted} / {totalAssigned} 件完了（{Math.round(totalCompleted / totalAssigned * 100)}%）</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
            <div className="h-full bg-green-500" style={{ width: `${(totalCompleted / totalAssigned) * 100}%` }} />
            <div className="h-full bg-orange-400" style={{ width: `${(totalAbsent / totalAssigned) * 100}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${(totalReturned / totalAssigned) * 100}%` }} />
          </div>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />完了</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />不在</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />持戻り</span>
          </div>
        </div>
      )}

      {/* ドライバー別カード */}
      <div className="space-y-3">
        {drivers.map((d) => (
          <ProgressDriverCard key={d.driverId} driver={d} date={date} />
        ))}
        {drivers.length === 0 && !loading && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">「進捗を表示」ボタンを押してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SumCard({ label, value, unit, highlight, green, orange, red }:
  { label: string; value: number; unit: string; highlight?: boolean; green?: boolean; orange?: boolean; red?: boolean }) {
  const color = green ? "text-green-700" : orange ? "text-orange-600" : red ? "text-red-600" : highlight ? "text-blue-700" : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}<span className="text-sm font-normal ml-1">{unit}</span></p>
    </div>
  );
}
