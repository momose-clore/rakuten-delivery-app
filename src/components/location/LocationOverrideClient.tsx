"use client";

import { useState, useEffect, useCallback } from "react";

type Status = "all" | "pending" | "approved" | "rejected";

interface Override {
  id: string;
  normalizedAddress: string;
  lat: number | null;
  lng: number | null;
  status: string;
  source: string;
  usageCount: number;
  entranceMemo: string | null;
  buildingMemo: string | null;
  nameplateMemo: string | null;
  accessMemo: string | null;
  cautionMemo: string | null;
  parkingMemo: string | null;
  createdAt: string;
  approvedBy: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function LocationOverrideClient() {
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/location-overrides?${params}`);
    if (res.ok) {
      const body = await res.json();
      setOverrides(body.overrides ?? []);
    }
    setLoading(false);
  }, [status, search]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleApprove(id: string) {
    await fetch(`/api/admin/location-overrides/${id}/approve`, { method: "POST" });
    void fetchData();
  }

  async function handleReject(id: string) {
    await fetch(`/api/admin/location-overrides/${id}/reject`, { method: "POST" });
    void fetchData();
  }

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">すべて</option>
          <option value="pending">承認待ち</option>
          <option value="approved">承認済み</option>
          <option value="rejected">却下</option>
        </select>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="住所で検索..."
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => void fetchData()}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
          検索
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">読み込み中...</p>}

      {/* 一覧 */}
      {overrides.length === 0 && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">データがありません</p>
        </div>
      )}

      <div className="space-y-3">
        {overrides.map((ov) => (
          <div key={ov.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium text-gray-900">{ov.normalizedAddress}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ov.status] ?? ""}`}>
                {ov.status}
              </span>
            </div>
            {(ov.lat && ov.lng) && (
              <p className="text-xs text-gray-500">座標: {ov.lat.toFixed(6)}, {ov.lng.toFixed(6)}</p>
            )}
            <div className="flex flex-wrap gap-1 text-xs">
              {ov.entranceMemo && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">入口: {ov.entranceMemo}</span>}
              {ov.buildingMemo && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">建物: {ov.buildingMemo}</span>}
              {ov.nameplateMemo && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">表札: {ov.nameplateMemo}</span>}
              {ov.parkingMemo && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">駐車: {ov.parkingMemo}</span>}
              {ov.cautionMemo && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded">注意: {ov.cautionMemo}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>ソース: {ov.source}</span>
              <span>使用回数: {ov.usageCount}</span>
            </div>
            {ov.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleApprove(ov.id)}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">承認</button>
                <button onClick={() => handleReject(ov.id)}
                  className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">却下</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
