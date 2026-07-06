"use client";

/**
 * 号車 GPS リアルタイム地図（管理者・本番）
 * - /api/admin/driver-locations を 30秒ごとにポーリング（既存のリアルタイム方針に準拠）
 * - 位置は OSM + Leaflet で表示（完全無料・キー/課金 不要）
 * - 一定時間更新の無い号車は「位置情報 古い」表示（半透明・グレー）
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveVehicleMap, type MapPin, type RouteStop } from "@/components/map/LiveVehicleMap";
import { WAREHOUSE } from "@/lib/maps/warehouse";

const POLL_MS = 30_000; // 30秒ポーリング
const STALE_SEC = 90; // これを超えて更新が無ければ「古い」扱い
const STALE = "#9ca3af";
// ドライバーごとの色分け（driverId をハッシュしてパレットから選ぶ＝毎回同じ色）
const DRIVER_PALETTE = [
  "#2f6fdb", "#e0245e", "#157347", "#b8923f", "#7c3aed", "#0891b2",
  "#ea580c", "#be185d", "#0d9488", "#4f46e5", "#ca8a04", "#c026d3",
];
function colorForDriver(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DRIVER_PALETTE[h % DRIVER_PALETTE.length];
}

const DEPOT = {
  name: WAREHOUSE.name,
  lat: WAREHOUSE.lat,
  lng: WAREHOUSE.lng,
  subtitle: WAREHOUSE.address,
};

type ApiLocation = {
  driverId: string;
  name: string;
  vehicle: string;
  lat: number;
  lng: number;
  staleSec: number;
};

function agoLabel(sec: number): string {
  if (sec < 60) return "数十秒前";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}分前`;
  return `${Math.round(m / 60)}時間前`;
}

export function LiveMapClient() {
  const [locations, setLocations] = useState<ApiLocation[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "stale">("all");
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null); // A③: 選択号車の道なりルート
  const [routeStops, setRouteStops] = useState<RouteStop[] | null>(null); // 配送先ピン（順番＋宛名）
  const [dayDrivers, setDayDrivers] = useState<{ driverId: string; name: string; vehicle: string; stopCount: number }[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/driver-locations", { cache: "no-store" });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = (await res.json()) as { locations: ApiLocation[]; serverTime: string };
      setLocations(data.locations);
      setUpdatedAt(new Date(data.serverTime).toLocaleTimeString("ja-JP"));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // 外部システム（位置API）の購読：マウント時に取得し、以降30秒ごとにポーリング。
    // setState は fetch 完了後（await 後の非同期継続）でのみ呼ぶため同期カスケードは起きない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    timerRef.current = setInterval(() => void load(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  // 本日配送のあるドライバー一覧を取得（GPS送信の有無に関わらず選べるようにする）。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/routes/drivers?date=${dateStr}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { drivers: typeof dayDrivers };
        if (!cancelled) setDayDrivers(data.drivers ?? []);
      } catch {
        /* 取得失敗は無視（セレクタが空になるだけ） */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr]);

  // A③: 号車を選択したら、その当日ルート（route_order順）の道なり経路を取得して地図に描く。
  // ORS_API_KEY 未設定/未生成なら path:null＝線は出ないだけ（GPS表示は不変）。
  useEffect(() => {
    if (!selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoutePath(null);
      setRouteStops(null);
      return;
    }
    let cancelled = false;
    const t = new Date();
    const dateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    void (async () => {
      try {
        const res = await fetch(
          `/api/routes/geometry?driverId=${encodeURIComponent(selected)}&date=${dateStr}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) {
            setRoutePath(null);
            setRouteStops(null);
          }
          return;
        }
        const data = (await res.json()) as { path: [number, number][] | null; stops?: RouteStop[] };
        if (!cancelled) {
          setRoutePath(data.path ?? null);
          setRouteStops(data.stops ?? null);
        }
      } catch {
        if (!cancelled) {
          setRoutePath(null);
          setRouteStops(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const activeCount = locations.filter((l) => l.staleSec <= STALE_SEC).length;
  const staleCount = locations.length - activeCount;
  const filteredLocations = locations.filter((l) => {
    if (filter === "active") return l.staleSec <= STALE_SEC;
    if (filter === "stale") return l.staleSec > STALE_SEC;
    return true;
  });

  const pins: MapPin[] = filteredLocations.map((l) => {
    const stale = l.staleSec > STALE_SEC;
    return {
      id: l.driverId,
      label: l.name || l.vehicle,
      color: stale ? STALE : colorForDriver(l.driverId),
      lat: l.lat,
      lng: l.lng,
      stale,
      popupHtml: `<b>${l.vehicle}</b> ${l.name}<br/>${agoLabel(l.staleSec)} 更新`,
    };
  });

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900">号車 リアルタイム地図</h1>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {locations.length} 台 稼働中
        </span>
        {/* 本日配送ドライバーのセレクタ（GPS未送信でもルート/配送先を表示できる） */}
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
        >
          <option value="">本日配送の号車を選択…（{dayDrivers.length}台）</option>
          {dayDrivers.map((d) => (
            <option key={d.driverId} value={d.driverId}>
              {d.vehicle}／{d.name}（{d.stopCount}件）
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span>30秒ごとに自動更新</span>
          {updatedAt && <span>最終更新 {updatedAt}</span>}
          <button
            onClick={() => void load()}
            className="rounded-md border border-gray-300 px-2.5 py-1 font-medium text-gray-600 hover:bg-gray-50"
          >
            今すぐ更新
          </button>
        </div>
      </div>

      {/* 絞り込みチップ */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: "all", label: "すべて", count: locations.length },
            { key: "active", label: "稼働中", count: activeCount },
            { key: "stale", label: "位置情報 古い", count: staleCount },
          ] as const
        ).map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "rounded-full px-2.5 py-1 text-[12px] font-medium transition " +
                (active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
            >
              {f.label} <span className={active ? "text-blue-100" : "text-gray-400"}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          位置情報の取得に失敗しました。ネットワークまたは権限を確認してください。
        </div>
      )}

      {/* 号車リスト（クリックで地図追従） */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        <div className="hidden w-56 shrink-0 overflow-auto rounded-lg border border-gray-200 bg-white md:block">
          {locations.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">
              現在地を送信中の号車はありません。
              <br />
              （ドライバーがアプリを開き、位置情報を許可すると表示されます）
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">該当する号車はありません</div>
          ) : (
            filteredLocations.map((l) => {
              const stale = l.staleSec > STALE_SEC;
              return (
                <button
                  key={l.driverId}
                  onClick={() => setSelected(l.driverId)}
                  className={
                    "flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 " +
                    (selected === l.driverId ? "bg-blue-50" : "")
                  }
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: stale ? STALE : colorForDriver(l.driverId) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-900">{l.vehicle}</span>
                    <span className="block truncate text-[11px] text-gray-500">{l.name}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-400">{agoLabel(l.staleSec)}</span>
                </button>
              );
            })
          )}
        </div>

        {/* 地図 */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          <LiveVehicleMap pins={pins} depot={DEPOT} follow={selected} routePath={routePath} routeStops={routeStops} />
        </div>
      </div>
    </div>
  );
}
