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

/** 配送先の停止点（配送順＋宛名）。地図に番号付きピンで表示する。 */
export type RouteStop = { seq: number; lat: number; lng: number; name?: string | null; building?: string | null };

// 標準地図：OpenStreetMap Japan（日本語ラベル・Googleマップ風の色付きロードマップ・無料・キー/課金不要）
// 地名/駅名/区名が日本語表示。CARTO Voyager は英語ラベルだったため日本語タイルに変更。
const STD_TILE = {
  url: "https://tile.openstreetmap.jp/{z}/{x}/{y}.png",
  options: {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors｜地図: <a href="https://openstreetmap.jp/">OSM Japan</a>',
  },
};
// 詳細：国土地理院タイル（建物・区画が細かく見える／無料・キー不要・出典表示で合法利用）
const GSI_TILE = {
  url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  options: {
    maxZoom: 18,
    attribution: '地図: <a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル（国土地理院）</a>',
  },
};
// サテライト：Esri World Imagery（無料・キー不要）
const SAT_TILE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  options: {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
  },
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
  polyline(latlngs: LatLng[], opts?: Record<string, unknown>): LeafletLayer;
  divIcon(opts: Record<string, unknown>): unknown;
  latLngBounds(coords: LatLng[]): unknown;
}
function getLeaflet(): LeafletStatic | undefined {
  return (window as unknown as { L?: LeafletStatic }).L;
}

/** ポップアップに個人情報（宛名）を差し込む前の最小 HTML エスケープ（XSS防止） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  routePath = null,
  routeStops = null,
}: {
  pins: MapPin[];
  depot: MapDepot;
  initialZoom?: number;
  follow?: string | null;
  showLegend?: boolean;
  className?: string;
  /** A③: 道なり経路（[lat,lng] の配列）。ORS Directions のジオメトリを渡すと地図に線を描く。 */
  routePath?: LatLng[] | null;
  /** 配送先ピン（配送順＋宛名）。選択号車のルート上の停止点を番号付きで表示する。 */
  routeStops?: RouteStop[] | null;
}) {
  const [base, setBase] = useState<"std" | "gsi" | "sat">("std"); // ベース地図：標準/詳細(GSI)/航空写真
  const [mapError, setMapError] = useState(false);
  const [ready, setReady] = useState(false);

  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<LeafletLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const routeLayerRef = useRef<LeafletLayer | null>(null); // A③: 道なり経路レイヤー
  const stopMarkersRef = useRef<LeafletMarker[]>([]); // 配送先ピン（順番＋宛名）
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

        tileRef.current = L.tileLayer(STD_TILE.url, STD_TILE.options);
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

  // ベース地図切替（タイルのみ差し替え）
  useEffect(() => {
    const L = getLeaflet();
    const map = mapRef.current;
    if (!L || !map) return;
    if (tileRef.current) tileRef.current.remove();
    const t = base === "sat" ? SAT_TILE : base === "gsi" ? GSI_TILE : STD_TILE;
    tileRef.current = L.tileLayer(t.url, t.options);
    tileRef.current.addTo(map);
  }, [base]);

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

  // A③: 道なり経路（ORS Directions ジオメトリ）を描画／更新
  useEffect(() => {
    const L = getLeaflet();
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    // 既存の経路線を除去してから引き直す
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (routePath && routePath.length >= 2) {
      routeLayerRef.current = L.polyline(routePath, {
        color: "#b8923f",
        weight: 4,
        opacity: 0.85,
      }).addTo(map);
    }
  }, [routePath, ready]);

  // 配送先ピン（配送順＋宛名）を描画／更新
  useEffect(() => {
    const L = getLeaflet();
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    // 既存の配送先ピンを消す
    for (const m of stopMarkersRef.current) m.remove();
    stopMarkersRef.current = [];
    if (!routeStops || routeStops.length === 0) return;

    for (const s of routeStops) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#26324F;color:#fff;font-size:11px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.4);border:1.5px solid #fff;">${s.seq}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const m = L.marker([s.lat, s.lng], { icon }).addTo(map);
      // 宛名・建物名は個人情報。表示のみ（ログには出さない）。HTMLエスケープして注入。
      const nameHtml = s.name ? escapeHtml(s.name) : "（宛名なし）";
      const buildingHtml = s.building
        ? `<br/><span style="color:#555;">🏢 ${escapeHtml(s.building)}</span>`
        : "";
      m.bindPopup(`<b>${s.seq}. ${nameHtml}</b>${buildingHtml}`);
      stopMarkersRef.current.push(m);
    }
  }, [routeStops, ready]);

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
        <div className="flex overflow-hidden rounded-md bg-white/95 text-[12px] shadow-sm">
          {(
            [
              { key: "std", label: "標準" },
              { key: "gsi", label: "詳細" },
              { key: "sat", label: "写真" },
            ] as const
          ).map((b) => (
            <button
              key={b.key}
              onClick={() => setBase(b.key)}
              className={
                "px-2.5 py-1.5 font-medium transition " +
                (base === b.key ? "bg-[#26324F] text-white" : "text-gray-600 hover:bg-gray-100")
              }
            >
              {b.label}
            </button>
          ))}
        </div>
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
