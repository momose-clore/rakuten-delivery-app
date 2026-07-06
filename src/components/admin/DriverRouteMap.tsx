"use client";

/**
 * ドライバー詳細の「配送先マップ」。
 * - 配送先ピン（配送順・遅配色分け）は詳細ページがサーバー側で組み立てて props で渡す（stops）。
 * - 道なりルート線（routePath）だけ read-only API `/api/routes/geometry` から取得（ORS未設定なら線なし）。
 * - 号車のGPS現在地ピンはここでは出さない（リアルタイム地図 /admin/live-map が担当）。
 * - 地図描画は共有コンポーネント LiveVehicleMap（OSM+Leaflet・無料・キー不要）。
 */

import { useEffect, useState } from "react";
import { LiveVehicleMap, type RouteStop, type MapDepot } from "@/components/map/LiveVehicleMap";

export function DriverRouteMap({
  driverId,
  date,
  stops,
  depot,
}: {
  driverId: string;
  date: string;
  stops: RouteStop[];
  depot: MapDepot;
}) {
  const [path, setPath] = useState<[number, number][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/routes/geometry?driverId=${encodeURIComponent(driverId)}&date=${encodeURIComponent(date)}&return=1`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { path?: [number, number][] | null };
        if (!cancelled) setPath(data.path ?? null);
      } catch {
        // 経路線が取れなくてもピン表示は継続（線なし）
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, date]);

  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      {stops.length === 0 ? (
        <div className="absolute inset-0 z-[400] flex items-center justify-center px-6 text-center text-sm text-gray-400">
          座標付きの配送先がありません。
          <br />
          （住所補正でピンを確定すると地図に表示されます）
        </div>
      ) : (
        <LiveVehicleMap
          pins={[]}
          depot={depot}
          routeStops={stops}
          routePath={path}
          showLegend={false}
          initialZoom={12}
        />
      )}
    </div>
  );
}
