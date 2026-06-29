"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RouteDriverPanel } from "./RouteDriverPanel";
import type { DriverRoute, LoadingMode } from "@/types/route";

const WAVE_OPTIONS = ["", "W1", "W2", "W3", "W4", "W5", "W6"];

export function RouteClient() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [waveNo, setWaveNo] = useState("");
  const [driverId] = useState(""); // ドライバー絞り込みは将来実装

  const [drivers, setDrivers] = useState<DriverRoute[]>([]);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [ungeocodedCount, setUngeocodedCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function fetchRoutes() {
    if (!date) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date });
    if (waveNo) params.set("waveNo", waveNo);
    if (driverId) params.set("driverId", driverId);
    const res = await fetch(`/api/routes?${params}`);
    setLoading(false);
    if (!res.ok) {
      setError("データ取得に失敗しました");
      return;
    }
    const body = await res.json();
    setDrivers(body.drivers ?? []);
    setGeocodedCount(body.geocodedCount ?? 0);
    setUngeocodedCount(body.ungeocodedCount ?? 0);
  }

  async function handleGeocode() {
    setGeocoding(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/routes/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, waveNo: waveNo || undefined, driverId: driverId || undefined }),
    });
    setGeocoding(false);
    if (!res.ok) {
      setError("Geocode に失敗しました");
      return;
    }
    const body = await res.json();
    setMessage(`Geocode 完了：成功 ${body.successCount} 件、失敗 ${body.failCount} 件`);
    await fetchRoutes();
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/routes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, waveNo: waveNo || undefined, driverId: driverId || undefined }),
    });
    setGenerating(false);
    if (!res.ok) {
      setError("ルート生成に失敗しました");
      return;
    }
    setMessage("ルート生成完了");
    await fetchRoutes();
  }

  async function handleLoadingModeChange(
    routeGroupId: string,
    loadingMode: LoadingMode,
    returnToWarehouse?: boolean
  ) {
    const res = await fetch("/api/routes/loading-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeGroupId, loadingMode, returnToWarehouse }),
    });
    if (res.ok) await fetchRoutes();
  }

  return (
    <div className="space-y-5">
      {/* フィルターパネル */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">ルート作成</h2>
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
          <Button onClick={fetchRoutes} disabled={loading || !date}>
            {loading ? "取得中..." : "一覧を表示"}
          </Button>
          <Button
            onClick={handleGeocode}
            disabled={geocoding || !date}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {geocoding ? "Geocode中..." : "住所 Geocode"}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || !date}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {generating ? "生成中..." : "ルート生成"}
          </Button>
        </div>

        {/* Geocode 状況 */}
        {(geocodedCount > 0 || ungeocodedCount > 0) && (
          <div className="mt-3 flex gap-3 text-sm">
            <span className="text-green-700">Geocode 済み: {geocodedCount} 件</span>
            {ungeocodedCount > 0 && (
              <span className="text-orange-600">未取得: {ungeocodedCount} 件（Geocode を実行してください）</span>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">{message}</p>}
      </div>

      {/* ドライバー別ルート */}
      {drivers.map((driver) => (
        <RouteDriverPanel
          key={driver.driverId}
          driver={driver}
          onLoadingModeChange={handleLoadingModeChange}
        />
      ))}

      {drivers.length === 0 && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">割当済みの配送明細がありません</p>
          <p className="text-xs text-gray-400 mt-1">STEP 6 で割当確定済みのデータがあることを確認してください</p>
        </div>
      )}
    </div>
  );
}
