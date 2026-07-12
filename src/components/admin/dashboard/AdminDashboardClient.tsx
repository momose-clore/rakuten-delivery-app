"use client";

/**
 * 管理者ダッシュボード（簡略版・集約ハブ）
 * - 上部: 増便申請 / CARIOシフト稼働実績(台数管理) へのボタン
 * - 遅配予想: 当日シフト名簿(CARIO)× Wave締切で「遅配しそうなドライバー」をマーク表示
 * - 号車リアルタイム地図（GPS・30秒ポーリング）
 * 取込/地図・住所/配車の各メニューはナビから非表示にし、必要機能をここへ集約。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlusSquare, BarChart3 } from "lucide-react";
import { LiveVehicleMap, type MapPin } from "@/components/map/LiveVehicleMap";
import { WAREHOUSE } from "@/lib/maps/warehouse";

const POLL_MS = 30_000;
const STALE_SEC = 90;
const DEPOT = { name: WAREHOUSE.name, lat: WAREHOUSE.lat, lng: WAREHOUSE.lng, subtitle: WAREHOUSE.address };

type ApiLocation = { driverId: string; name: string; vehicle: string; lat: number; lng: number; staleSec: number };
type LateStatus = "late" | "atRisk" | "onTime" | "done" | "none";
interface LateDriver {
  driverId: string; name: string; vehicleId: string | null; area: string | null;
  companyName: string | null; total: number; completed: number; remaining: number; status: LateStatus;
}

const MARK: Record<LateStatus, { icon: string; label: string; badge: string; pin: string }> = {
  late:   { icon: "🔴", label: "遅配見込み", badge: "bg-red-100 text-red-700",       pin: "#dc2626" },
  atRisk: { icon: "🟠", label: "締切間近",   badge: "bg-amber-100 text-amber-700",   pin: "#d97706" },
  onTime: { icon: "🟢", label: "順調",       badge: "bg-green-100 text-green-700",   pin: "#0f7b6c" },
  done:   { icon: "✅", label: "完了",       badge: "bg-gray-100 text-gray-500",     pin: "#0f7b6c" },
  none:   { icon: "⚪", label: "担当未割当", badge: "bg-gray-100 text-gray-400",     pin: "#6b7280" },
};

export function AdminDashboardClient() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [drivers, setDrivers] = useState<LateDriver[]>([]);
  const [locations, setLocations] = useState<ApiLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLate = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/admin/late-forecast?date=${date}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setLoading(false);
    if (data) setDrivers((data.drivers ?? []) as LateDriver[]);
  }, [date]);

  const loadLoc = useCallback(async () => {
    const data = await fetch("/api/admin/driver-locations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (data) setLocations((data.locations ?? []) as ApiLocation[]);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadLate(); }, [loadLate]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLoc();
    timerRef.current = setInterval(() => void loadLoc(), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadLoc]);

  const lateCount = drivers.filter((d) => d.status === "late").length;
  const riskCount = drivers.filter((d) => d.status === "atRisk").length;

  // GPSピン：ドライバー名ラベル＋遅配ステータスで色分け（古い位置はグレー）
  const statusById = new Map(drivers.map((d) => [d.driverId, d.status]));
  const pins: MapPin[] = locations.map((l) => {
    const stale = l.staleSec > STALE_SEC;
    const st = statusById.get(l.driverId);
    return {
      id: l.driverId,
      label: l.name || l.vehicle,
      color: stale ? "#9ca3af" : (st ? MARK[st].pin : "#2f6fdb"),
      lat: l.lat, lng: l.lng, stale,
      popupHtml: `<b>${l.name}</b> ${l.vehicle}`,
    };
  });

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{DEPOT.name}</h1>
          <p className="text-[11px] text-gray-400">{DEPOT.subtitle}</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        <button onClick={() => void loadLate()} className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
          更新
        </button>
        {loading && <span className="text-xs text-gray-400">読込中…</span>}
      </div>

      {/* 集約ボタン */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/admin/extra-vehicle-requests"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><PlusSquare size={20} /></span>
          <span>
            <span className="block font-semibold text-gray-900">増便申請</span>
            <span className="block text-xs text-gray-500">増便の申請・承認・LINE報告</span>
          </span>
        </Link>
        <Link href="/admin/vehicle-count"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><BarChart3 size={20} /></span>
          <span>
            <span className="block font-semibold text-gray-900">CARIOシフト稼働実績</span>
            <span className="block text-xs text-gray-500">Wave別の稼働台数・消化進捗（台数管理表）</span>
          </span>
        </Link>
      </div>

      {/* 遅配予想 */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-700">遅配予想（本日シフト名簿）</h2>
          {lateCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">🔴 遅配見込み {lateCount}</span>}
          {riskCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">🟠 締切間近 {riskCount}</span>}
          <span className="ml-auto text-[11px] text-gray-400">CARIO 楽天美女木シフト × Wave締切で判定</span>
        </div>
        {drivers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {loading ? "読込中…" : "この日のシフト名簿がありません（CARIOシフト取込が必要）"}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {drivers.map((d) => {
              const m = MARK[d.status];
              return (
                <li key={d.driverId}>
                  <Link href={`/admin/progress/${d.driverId}?date=${date}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                    <span className="text-base leading-none">{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{d.name}</span>
                        <span className="text-[11px] text-gray-400">{d.vehicleId ?? "—"}・{d.companyName ?? d.area ?? "—"}</span>
                      </span>
                      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${m.badge}`}>{m.label}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-gray-500">
                      {d.total > 0 ? <>残 {d.remaining}/{d.total}件</> : "担当なし"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 号車リアルタイム地図 */}
      <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm">
        <LiveVehicleMap pins={pins} depot={DEPOT} />
      </div>
    </div>
  );
}
