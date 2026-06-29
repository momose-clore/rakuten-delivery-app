"use client";

import { useState } from "react";
import type { DriverRoute, RouteGroupInfo, LoadingMode } from "@/types/route";

interface Props {
  driver: DriverRoute;
  onLoadingModeChange: (routeGroupId: string, loadingMode: LoadingMode, returnToWarehouse?: boolean) => Promise<void>;
}

export function RouteDriverPanel({ driver, onLoadingModeChange }: Props) {
  const [updating, setUpdating] = useState(false);

  const sortedItems = [...driver.items].sort(
    (a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999)
  );

  const ungeocodedCount = driver.items.filter((i) => i.lat === null).length;

  async function handleLoadingChange(rg: RouteGroupInfo, mode: LoadingMode) {
    setUpdating(true);
    await onLoadingModeChange(rg.routeGroupId!, mode);
    setUpdating(false);
  }

  async function handleReturnChange(rg: RouteGroupInfo, returnToWarehouse: boolean) {
    setUpdating(true);
    await onLoadingModeChange(rg.routeGroupId!, rg.loadingMode, returnToWarehouse);
    setUpdating(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-gray-900">{driver.driverName}</span>
          <span className="ml-2 text-sm text-gray-500">{driver.companyName ?? "—"}</span>
          <span className="ml-2 text-sm text-gray-500">{driver.area ?? "—"}</span>
          <span className="ml-2 text-sm text-gray-500">車両: {driver.vehicleId ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">{driver.items.length} 件</span>
          {ungeocodedCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
              Geocode 未取得: {ungeocodedCount} 件
            </span>
          )}
        </div>
      </div>

      {/* 積み込みモード・倉庫戻り設定 */}
      {driver.routeGroups.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-3">
          {driver.routeGroups.map((rg) => (
            <div key={rg.waveGroup} className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 font-medium">{rg.waveGroup}:</span>
              <select
                value={rg.loadingMode}
                onChange={(e) => handleLoadingChange(rg, e.target.value as LoadingMode)}
                disabled={updating || !rg.routeGroupId}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="SIMULTANEOUS">同時積み込み</option>
                <option value="SPLIT">分割積み込み</option>
              </select>
              <select
                value={rg.returnToWarehouse ? "return" : "direct"}
                onChange={(e) => handleReturnChange(rg, e.target.value === "return")}
                disabled={updating || !rg.routeGroupId}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="return">倉庫戻り</option>
                <option value="direct">直帰</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Google Maps URL */}
      {driver.mapsUrls.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-2">
          {driver.mapsUrls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
            >
              Google Maps で開く{driver.mapsUrls.length > 1 ? ` (${idx + 1}/${driver.mapsUrls.length})` : ""}
            </a>
          ))}
        </div>
      )}

      {/* 配送順テーブル */}
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {["順", "配車No", "W番号", "号車", "住所", "数量", "備考", "Geo"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedItems.map((item) => (
            <tr
              key={item.assignmentId}
              className={item.lat === null ? "bg-orange-50" : "hover:bg-gray-50"}
            >
              <td className="px-3 py-2 font-bold text-gray-900">
                {item.routeOrder ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono">{item.dispatchKey ?? "—"}</td>
              <td className="px-3 py-2">{item.waveNo ?? "—"}</td>
              <td className="px-3 py-2">{item.vehicleNo ?? "—"}</td>
              <td className="px-3 py-2 max-w-[180px] truncate text-gray-700">
                {item.address ?? "—"}
              </td>
              <td className="px-3 py-2 text-gray-700">{item.totalCount ?? "—"}</td>
              <td className="px-3 py-2 text-gray-500">{item.memo ?? ""}</td>
              <td className="px-3 py-2">
                {item.lat !== null ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-orange-500">未</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
