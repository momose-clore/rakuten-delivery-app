"use client";

/**
 * 管理者ダッシュボード（集約ハブ・きちんとレイアウト版）
 * - 上部: 遅配アラート帯（遅配/締切間近の件数）
 * - アクション: 増便申請 / CARIOシフト稼働実績(台数管理)
 * - メイン2カラム: 左=遅配予想（当日CARIOシフト名簿×Wave締切でマーク）／右=号車リアルタイム地図(GPS)
 * 取込/地図・住所/配車の各メニューはナビ非表示。必要機能はここへ集約。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlusSquare, BarChart3, ChevronRight, RefreshCw } from "lucide-react";
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
  late:   { icon: "🔴", label: "遅配見込み", badge: "bg-red-100 text-red-700",     pin: "#dc2626" },
  atRisk: { icon: "🟠", label: "締切間近",   badge: "bg-amber-100 text-amber-700", pin: "#d97706" },
  onTime: { icon: "🟢", label: "順調",       badge: "bg-green-100 text-green-700", pin: "#0f7b6c" },
  done:   { icon: "✅", label: "完了",       badge: "bg-gray-100 text-gray-500",   pin: "#0f7b6c" },
  none:   { icon: "⚪", label: "担当未割当", badge: "bg-gray-100 text-gray-400",   pin: "#6b7280" },
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
  const activeCount = locations.filter((l) => l.staleSec <= STALE_SEC).length;

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
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* ===== ヘッダー ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">{DEPOT.name}</h1>
          <p className="text-xs text-gray-400">{DEPOT.subtitle} ・ 配送状況ダッシュボード</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => void loadLate()}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 更新
          </button>
        </div>
      </div>

      {/* ===== 遅配アラート帯 ===== */}
      {lateCount > 0 || riskCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm font-bold text-red-700">⚠ 要対応</span>
          {lateCount > 0 && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">🔴 遅配見込み {lateCount}名</span>}
          {riskCount > 0 && <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">🟠 締切間近 {riskCount}名</span>}
          <span className="text-xs text-red-600/80">Wave時間帯に間に合わない見込みのドライバーがいます</span>
        </div>
      ) : drivers.length > 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
          🟢 現時点で遅配見込みのドライバーはいません
        </div>
      ) : null}

      {/* ===== アクション ===== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ActionCard href="/admin/extra-vehicle-requests" icon={<PlusSquare size={20} />} tone="blue"
          title="増便申請" desc="増便の申請・承認・LINE報告" />
        <ActionCard href="/admin/vehicle-count" icon={<BarChart3 size={20} />} tone="emerald"
          title="CARIOシフト稼働実績" desc="Wave別の稼働台数・消化進捗（台数管理表）" />
      </div>

      {/* ===== メイン2カラム：遅配予想（左）＋ 地図（右） ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,440px)_1fr]">
        {/* 遅配予想 */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">遅配予想</h2>
            <span className="text-[11px] text-gray-400">本日シフト {drivers.length}名</span>
            <span className="ml-auto text-[11px] text-gray-400">CARIO 楽天美女木 × Wave締切</span>
          </div>
          <div className="max-h-[560px] overflow-auto">
            {drivers.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                {loading ? "読込中…" : "この日のシフト名簿がありません（CARIOシフト取込が必要）"}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {drivers.map((d) => {
                  const m = MARK[d.status];
                  return (
                    <li key={d.driverId}>
                      <Link href={`/admin/progress/${d.driverId}?date=${date}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50">
                        <span className="text-lg leading-none">{m.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium text-gray-900">{d.name}</span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.badge}`}>{m.label}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-gray-400">
                            {d.vehicleId ?? "—"} ・ {d.companyName ?? d.area ?? "—"}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-medium text-gray-700">
                            {d.total > 0 ? `残 ${d.remaining}` : "—"}
                          </span>
                          <span className="block text-[10px] text-gray-400">{d.total > 0 ? `/ ${d.total}件` : "担当なし"}</span>
                        </span>
                        <ChevronRight size={16} className="shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 号車リアルタイム地図 */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">号車リアルタイム地図</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">稼働中 {activeCount}</span>
            <span className="ml-auto text-[11px] text-gray-400">30秒ごと自動更新</span>
          </div>
          <div className="relative min-h-[560px] flex-1 bg-gray-100">
            <LiveVehicleMap pins={pins} depot={DEPOT} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionCard({ href, icon, tone, title, desc }: {
  href: string; icon: React.ReactNode; tone: "blue" | "emerald"; title: string; desc: string;
}) {
  const toneCls = tone === "blue" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600";
  return (
    <Link href={href}
      className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneCls}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900">{title}</span>
        <span className="block truncate text-xs text-gray-500">{desc}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-gray-300 transition group-hover:text-blue-400" />
    </Link>
  );
}
