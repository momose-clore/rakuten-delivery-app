"use client";

/**
 * 管理者ダッシュボード（本番・実データ）
 * レイアウトは α の /admin-preview を本採用。データは既存APIを実接続：
 *   - GET /api/admin/dashboard         … 集計メトリクス（DashboardStats）
 *   - GET /api/admin/progress?date=    … 号車（ドライバー別）進捗一覧
 *   - GET /api/admin/driver-locations  … 号車GPS現在地（30秒ポーリング）
 * 地図は共有コンポーネント LiveVehicleMap（OSM+Leaflet・完全無料）を再利用。
 * α区画（live-map / admin-preview / map / tracker / 位置API）は編集しない。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveVehicleMap, type MapPin } from "@/components/map/LiveVehicleMap";
import { WAREHOUSE } from "@/lib/maps/warehouse";
import type { DashboardStats, DriverProgress } from "@/types/progress";

const TEAL = "#0f7b6c";
const BLUE = "#2f6fdb";
const AMBER = "#d97706";
const RED = "#dc2626";
const GRAY = "#9ca3af";
const POLL_MS = 30_000;
const STALE_SEC = 90;

const DEPOT = { name: WAREHOUSE.name, lat: WAREHOUSE.lat, lng: WAREHOUSE.lng, subtitle: WAREHOUSE.address };

type ApiLocation = { driverId: string; name: string; vehicle: string; lat: number; lng: number; staleSec: number };
type Category = "delivering" | "delayed" | "undeparted" | "completed";

function catOf(d: DriverProgress): Category {
  if (d.totalCount > 0 && d.completedCount >= d.totalCount) return "completed";
  if (d.absentCount > 0 || d.returnedCount > 0) return "delayed";
  if (d.completedCount === 0 && !d.lastUpdatedAt) return "undeparted";
  return "delivering";
}
function statusOf(d: DriverProgress): { text: string; tone?: "ok" | "warn" | "danger" } {
  switch (catOf(d)) {
    case "completed": return { text: "完了 ｜ 全件終了", tone: "ok" };
    case "delayed": return { text: `遅延・不在 ｜ 不在${d.absentCount}/持戻${d.returnedCount}`, tone: "warn" };
    case "undeparted": return { text: "未出発 ｜ 進捗なし", tone: "danger" };
    default: return { text: "配送中" };
  }
}
const CAT_COLOR: Record<Category, string> = { completed: TEAL, delivering: BLUE, delayed: AMBER, undeparted: RED };

const FILTERS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "delivering", label: "配送中" },
  { key: "delayed", label: "遅延・不在" },
  { key: "undeparted", label: "未出発" },
  { key: "completed", label: "完了" },
];

export function AdminDashboardClient() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [drivers, setDrivers] = useState<DriverProgress[]>([]);
  const [locations, setLocations] = useState<ApiLocation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      fetch(`/api/admin/dashboard?date=${date}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/admin/progress?date=${date}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setLoading(false);
    if (s) setStats(s as DashboardStats);
    if (p) setDrivers((p.drivers ?? []) as DriverProgress[]);
  }, [date]);

  const loadLocations = useCallback(async () => {
    const data = await fetch("/api/admin/driver-locations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (data) setLocations((data.locations ?? []) as ApiLocation[]);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLocations();
    timerRef.current = setInterval(() => void loadLocations(), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadLocations]);

  // 集計（実データ）
  const freshLocs = locations.filter((l) => l.staleSec <= STALE_SEC).length;
  const totalItems = drivers.reduce((s, d) => s + d.totalCount, 0);
  const doneItems = drivers.reduce((s, d) => s + d.completedCount, 0);
  const inProg = drivers.reduce((s, d) => s + d.inProgressCount, 0);
  const delayedCount = drivers.filter((d) => catOf(d) === "delayed").length;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const vehicleStats: Stat[] = [
    { value: drivers.length, label: "稼働号車" },
    { value: delayedCount, label: "遅延・不在", tone: delayedCount ? "warn" : "default" },
    { value: Math.max(0, (stats?.activeDriverCount ?? 0) - freshLocs), label: "未サインイン", tone: "muted" },
    { value: freshLocs, label: "位置更新中" },
  ];
  const crewStats: Stat[] = [
    { value: freshLocs, label: "稼働中" },
    { value: Math.max(0, drivers.length - freshLocs), label: "オフライン", tone: "muted" },
    { value: stats?.activeDriverCount ?? 0, label: "本日予定" },
  ];
  const packageStats: Stat[] = [
    { value: stats?.absentCount ?? 0, label: "不在" },
    { value: stats?.returnedCount ?? 0, label: "持ち戻り" },
    { value: stats?.unassignedCount ?? 0, label: "未着手", tone: "muted" },
  ];
  const importStats: Stat[] = [
    { value: stats?.ocrPendingCount ?? 0, label: "OCR未確認", tone: (stats?.ocrPendingCount ?? 0) ? "warn" : "default" },
    { value: stats?.addressErrorCount ?? 0, label: "住所エラー", tone: (stats?.addressErrorCount ?? 0) ? "warn" : "default" },
    { value: stats?.countMismatchCount ?? 0, label: "数量エラー", tone: "muted" },
  ];
  const donuts = [
    { pct: pct(doneItems, totalItems), label: "配達完了率" },
    { pct: pct(inProg, totalItems), label: "配送中率" },
    { pct: pct(freshLocs, stats?.activeDriverCount ?? 0), label: "稼働率" },
  ];

  const filteredDrivers = filter === "all" ? drivers : drivers.filter((d) => catOf(d) === filter);
  const visibleIds = new Set(filteredDrivers.map((d) => d.driverId));

  // GPSピン（号車進捗のステータス色で着色・古い位置はグレー）
  const statusById = new Map(drivers.map((d) => [d.driverId, catOf(d)]));
  const pins: MapPin[] = locations
    .filter((l) => visibleIds.size === 0 || visibleIds.has(l.driverId) || filter === "all")
    .map((l) => {
      const stale = l.staleSec > STALE_SEC;
      const cat = statusById.get(l.driverId);
      return {
        id: l.driverId,
        label: l.name || l.vehicle,
        color: stale ? GRAY : (cat ? CAT_COLOR[cat] : BLUE),
        lat: l.lat,
        lng: l.lng,
        stale,
        popupHtml: `<b>${l.vehicle}</b> ${l.name}`,
      };
    });

  return (
    <div className="space-y-4">
      {/* サブヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{DEPOT.name}</h1>
          <p className="text-[11px] text-gray-400">{DEPOT.subtitle} ・ 配送状況ダッシュボード</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        {loading && <span className="text-xs text-gray-400">更新中…</span>}
        <span className="ml-auto text-xs text-gray-400">GPSは30秒ごとに自動更新</span>
      </div>

      {/* メトリクスカード */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="号車"><StatGroup stats={vehicleStats} /></MetricCard>
        <MetricCard title="クルー稼働状況"><StatGroup stats={crewStats} /></MetricCard>
        <MetricCard title="荷物ステータス"><StatGroup stats={packageStats} /></MetricCard>
        <MetricCard title="実行の進行状況">
          <div className="flex justify-between gap-1">
            {donuts.map((d) => <Donut key={d.label} pct={d.pct} label={d.label} />)}
          </div>
        </MetricCard>
        <MetricCard title="取込・要確認"><StatGroup stats={importStats} /></MetricCard>
      </div>

      {/* メイン：号車一覧 + 地図 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 px-2 py-2">
            {FILTERS.map((f) => {
              const count = f.key === "all" ? drivers.length : drivers.filter((d) => catOf(d) === f.key).length;
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={"rounded-full px-2.5 py-1 text-[12px] font-medium transition " +
                    (active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                  {f.label} <span className={active ? "text-blue-100" : "text-gray-400"}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="max-h-[520px] overflow-auto">
            {filteredDrivers.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                {drivers.length === 0 ? "この日の割当・進捗データがありません" : "該当する号車はありません"}
              </div>
            ) : (
              filteredDrivers.map((d) => (
                <RouteRow key={d.driverId} d={d} selected={selected === d.driverId}
                  onSelect={() => setSelected(d.driverId)} hasGps={locations.some((l) => l.driverId === d.driverId)} />
              ))
            )}
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm">
          <LiveVehicleMap pins={pins} depot={DEPOT} follow={selected} />
        </div>
      </div>
    </div>
  );
}

/* ===== 小物（α preview 準拠・自己完結） ===== */

type Stat = { value: number; label: string; tone?: "default" | "warn" | "muted" };

function StatGroup({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex items-end gap-4">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0">
          <div className={"text-2xl font-bold leading-none " +
            (s.tone === "warn" ? "text-amber-600" : s.tone === "muted" ? "text-gray-400" : "text-gray-900")}>
            {s.value}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 whitespace-nowrap">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={TEAL} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{pct}%</div>
      </div>
      <div className="text-[10px] text-gray-500 text-center leading-tight">{label}</div>
    </div>
  );
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 text-[11px] font-semibold text-gray-500">{title}</div>
      {children}
    </div>
  );
}

function RouteRow({ d, selected, onSelect, hasGps }: {
  d: DriverProgress; selected: boolean; onSelect: () => void; hasGps: boolean;
}) {
  const pct = d.totalCount > 0 ? Math.round((d.completedCount / d.totalCount) * 100) : 0;
  const st = statusOf(d);
  return (
    <button onClick={onSelect}
      className={"flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 " +
        (selected ? "bg-blue-50" : "")}>
      <div className="w-20 shrink-0">
        <div className="text-sm font-bold text-gray-900">{d.vehicleId ?? "—"}</div>
        <div className="text-[10px] text-gray-400">{d.companyName ?? "—"}</div>
        <div className="text-[10px] text-gray-400">{d.area ?? "—"}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-gray-800">{d.driverName}</span>
          {hasGps && <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">GPS</span>}
        </div>
        <div className={"truncate text-[11px] " +
          (st.tone === "warn" ? "text-amber-600" : st.tone === "danger" ? "text-red-600" : "text-gray-400")}>
          {st.text}
        </div>
      </div>
      <div className="w-32 shrink-0">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? TEAL : BLUE }} />
        </div>
        <div className="mt-1 text-right text-[10px] text-gray-500">{d.completedCount}/{d.totalCount} 配送</div>
      </div>
    </button>
  );
}
