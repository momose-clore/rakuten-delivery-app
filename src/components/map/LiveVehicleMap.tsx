"use client";

/**
 * 号車リアルタイム地図（OSM + Leaflet・完全無料・キー/課金 不要）
 *
 * - Leaflet 本体は public/vendor/leaflet/ に自己ホスト（CSP 'self' で通過）
 * - タイル: OpenStreetMap（標準）/ Esri World Imagery（サテライト）… どちらもキー不要
 * - pins が変わるたびにマーカーを再描画（GPS ポーリング更新に対応）
 * - follow に pin.id を渡すと地図がその号車に追従
 *
 * ナビ（1件ディープリンク）・住所補正(Geocoding)は従来どおり Google を使用（本コンポーネントでは扱わない）。
 */

import { useEffect, useRef, useState } from "react";

export type MapPin = {
  id: string;
  label: string; // 例: "3号車"
  color: string; // ピン色
  lat: number;
  lng: number;
  popupHtml?: string; // クリック時ポップアップ（内容は呼び出し側で組み立て）
  stale?: boolean; // 位置が古い（一定時間更新なし）→ 半透明表示
};

export type MapDepot = { name: string; lat: number; lng: number; subtitle?: string };

const OSM_TILE = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
const SAT_TILE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
};

/* Leaflet 最小型ファサード（自己ホスト JS をグローバル window.L から使う） */
type LatLng = [number, number];
interface LeafletLayer {
  addTo(m: LeafletMap): LeafletLayer;
  remove(): void;
}
interface LeafletMarker extends LeafletLayer {
  addTo(m: LeafletMap): LeafletMarker;
  bindPopup(html: string): LeafletMarker;
  setLatLng(c: LatLng): LeafletMarker;
}
interface LeafletMap {
  setView(center: LatLng, zoom?: number): LeafletMap;
  fitBounds(bounds: unknown, opts?: Record<string, unknown>): void;
  invalidateSize(): void;
  remove(): void;
}
interface LeafletStatic {
  map(el: HTMLElement, opts?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, opts?: Record<string, unknown>): LeafletLayer;
  marker(center: LatLng, opts?: Record<string, unknown>): LeafletMarker;
  divIcon(opts: Record<string, unknown>): unknown;
  latLngBounds(coords: LatLng[]): unknown;
}
function getLeaflet(): LeafletStatic | undefined {
  return (window as unknown as { L?: LeafletStatic }).L;
}

function pinIcon(L: LeafletStatic, label: string, color: string, stale: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;padding:2px 7px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4);border:1.5px solid #fff;opacity:${stale ? 0.45 : 1};">${label}</div>`,
    iconSize: [52, 20],
    iconAnchor: [26, 10],
  });
}

export function LiveVehicleMap({
  pins,
  depot,
  initialZoom = 11,
  follow = null,
  showLegend = true,
  className = "absolute inset-0 z-0",
}: {
  pins: MapPin[];
  depot: MapDepot;
  initialZoom?: number;
  follow?: string | null;
  showLegend?: boolean;
  className?: string;
}) {
  const [sat, setSat] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [ready, setReady] = useState(false);

  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<LeafletLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const fittedRef = useRef(false); // 初回自動フィット済みか

  // 全号車＋拠点が収まる画角に合わせる
  const fitAll = () => {
    const L = getLeaflet();
    const map = mapRef.current;
    if (!L || !map) return;
    const coords: LatLng[] = [[depot.lat, depot.lng], ...pins.map((p) => [p.lat, p.lng] as LatLng)];
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 });
  };

  // 初期化（マウント時1回）
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current; // cleanup 用に同一インスタンスを退避

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "/vendor/leaflet/leaflet.css";
      document.head.appendChild(link);
    }

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if (getLeaflet()) return resolve();
        const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("leaflet load failed")));
          return;
        }
        const s = document.createElement("script");
        s.id = "leaflet-js";
        s.src = "/vendor/leaflet/leaflet.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("leaflet load failed"));
        document.body.appendChild(s);
      });

    loadScript()
      .then(() => {
        if (cancelled) return;
        const L = getLeaflet();
        const el = elRef.current;
        if (!L || !el || mapRef.current) return;

        const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(
          [depot.lat, depot.lng],
          initialZoom,
        );
        mapRef.current = map;

        tileRef.current = L.tileLayer(OSM_TILE.url, { maxZoom: 19, attribution: OSM_TILE.attribution });
        tileRef.current.addTo(map);

        // 拠点マーカー
        L.marker([depot.lat, depot.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:9999px;background:#26324F;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.45);border:1.5px solid #fff;">🏭 拠点</div>`,
            iconSize: [64, 22],
            iconAnchor: [32, 11],
          }),
        })
          .addTo(map)
          .bindPopup(`<b>${depot.name}</b>${depot.subtitle ? `<br/>${depot.subtitle}` : ""}`);

        map.invalidateSize();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
      markers.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // サテライト切替（タイルのみ差し替え）
  useEffect(() => {
    const L = getLeaflet();
    const map = mapRef.current;
    if (!L || !map) return;
    if (tileRef.current) tileRef.current.remove();
    const t = sat ? SAT_TILE : OSM_TILE;
    tileRef.current = L.tileLayer(t.url, { maxZoom: 19, attribution: t.attribution });
    tileRef.current.addTo(map);
  }, [sat]);

  // ピン更新（GPS ポーリングで pins が変わるたびに反映）
  useEffect(() => {
    const L = getLeaflet();
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const p of pins) {
      seen.add(p.id);
      const existing = markers.get(p.id);
      if (existing) {
        existing.setLatLng([p.lat, p.lng]);
      } else {
        const m = L.marker([p.lat, p.lng], { icon: pinIcon(L, p.label, p.color, !!p.stale) }).addTo(map);
        if (p.popupHtml) m.bindPopup(p.popupHtml);
        markers.set(p.id, m);
      }
    }
    // 消えた号車のマーカーを除去
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        m.remove();
        markers.delete(id);
      }
    }

    // 初回だけ全号車が収まる画角に自動フィット（追従指定が無いとき）
    if (!fittedRef.current && pins.length > 0 && !follow) {
      const coords: LatLng[] = [[depot.lat, depot.lng], ...pins.map((p) => [p.lat, p.lng] as LatLng)];
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [pins, ready, follow, depot]);

  // 追従（指定号車を中心に）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow) return;
    const target = pins.find((p) => p.id === follow);
    if (target) map.setView([target.lat, target.lng]);
  }, [follow, pins]);

  return (
    <>
      <div ref={elRef} className={className} />

      {mapError && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-gray-100 text-sm text-gray-400">
          地図の読み込みに失敗しました（/vendor/leaflet を確認）
        </div>
      )}

      <div className="absolute right-3 top-3 z-[1000] flex items-center gap-2">
        <button
          onClick={fitAll}
          className="rounded-md bg-white/95 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm hover:bg-white"
        >
          全体表示
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-[12px] shadow-sm">
          <input type="checkbox" checked={sat} onChange={(e) => setSat(e.target.checked)} />
          サテライト
        </label>
      </div>

      {showLegend && (
        <div className="absolute bottom-4 left-3 z-[1000] rounded-md bg-white/95 px-3 py-2 text-[11px] shadow-sm">
          <div className="mb-1 font-semibold text-gray-600">号車ステータス</div>
          <div className="flex flex-col gap-0.5">
            <LegendDot color="#0f7b6c" label="完了" />
            <LegendDot color="#2f6fdb" label="配送中" />
            <LegendDot color="#d97706" label="遅延・不在対応" />
            <LegendDot color="#dc2626" label="未出発" />
            <LegendDot color="#9ca3af" label="位置情報 古い" />
          </div>
        </div>
      )}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-gray-500">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}
