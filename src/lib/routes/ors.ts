import type { GeoPoint } from "./sortByNearest";

// OpenRouteService 最適化API（VROOMエンジン）。無料枠2,500req/日・カード不要。
const ORS_OPTIMIZATION_ENDPOINT = "https://api.openrouteservice.org/optimization";
// 道なり経路ジオメトリ（A③）。GeoJSON LineString を返す。
const ORS_DIRECTIONS_ENDPOINT = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
// 無料枠・APIの現実的な上限を考慮した保険。これを超える件数は直線ベースにフォールバック。
const MAX_JOBS = 70;
// ORS Directions の経由地上限（無料枠）に配慮した保険。
const MAX_WAYPOINTS = 50;

interface OrsStep {
  type: string; // "start" | "job" | "end"
  job?: number; // job の場合のみ（= jobs[].id）
}

/**
 * 道路ベースで最適な配送順を求める（OpenRouteService 最適化API）。
 *
 * - `ORS_API_KEY` 未設定 / API失敗 / 想定外レスポンス / 件数過多 のときは **null** を返し、
 *   呼び出し側で直線ベース（最近隣法+2-opt）にフォールバックさせる（＝無料枠・障害時も安全）。
 * - APIキーはログに出さない。座標のみを送る。
 */
export async function optimizeRouteRoad(
  origin: GeoPoint,
  points: GeoPoint[],
  returnToWarehouse: boolean
): Promise<GeoPoint[] | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) return null;
  if (points.length < 2) return [...points];
  if (points.length > MAX_JOBS) return null;

  try {
    const body = {
      jobs: points.map((p, i) => ({ id: i + 1, location: [p.lng, p.lat] })),
      vehicles: [
        {
          id: 1,
          profile: "driving-car",
          start: [origin.lng, origin.lat],
          ...(returnToWarehouse ? { end: [origin.lng, origin.lat] } : {}),
        },
      ],
    };

    const res = await fetch(ORS_OPTIMIZATION_ENDPOINT, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: { steps?: OrsStep[] }[];
    };
    const steps = data.routes?.[0]?.steps;
    if (!steps) return null;

    const ordered: GeoPoint[] = [];
    for (const s of steps) {
      if (s.type === "job" && typeof s.job === "number") {
        const p = points[s.job - 1];
        if (p) ordered.push(p);
      }
    }
    // 全件が割り当てられていなければ信頼せずフォールバック
    if (ordered.length !== points.length) return null;
    return ordered;
  } catch {
    return null;
  }
}

/**
 * A③: 道なり経路のジオメトリ（[lat,lng] の配列）を返す。
 * 起点→各配送先（配送順）→(倉庫戻りなら起点) を実道路で結ぶ線。地図の polyline 描画用。
 * ORS_API_KEY 未設定 / 失敗 / 経由地過多 は null（地図は線を描かないだけで壊れない）。
 * ※ points は既に最適順に並んでいる前提（route_order 順）。
 */
export async function getRouteGeometry(
  origin: GeoPoint,
  orderedPoints: GeoPoint[],
  returnToWarehouse: boolean
): Promise<[number, number][] | null> {
  const key = process.env.ORS_API_KEY;
  if (!key) return null;
  if (orderedPoints.length < 1) return null;

  // [経度, 緯度] の順（ORS/GeoJSON 仕様）
  const coordinates: [number, number][] = [
    [origin.lng, origin.lat],
    ...orderedPoints.map((p) => [p.lng, p.lat] as [number, number]),
  ];
  if (returnToWarehouse) coordinates.push([origin.lng, origin.lat]);
  if (coordinates.length > MAX_WAYPOINTS) return null;

  try {
    const res = await fetch(ORS_DIRECTIONS_ENDPOINT, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const line = data.features?.[0]?.geometry?.coordinates;
    if (!line || line.length < 2) return null;

    // GeoJSON は [経度,緯度] → Leaflet 用に [緯度,経度] へ変換
    return line.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return null;
  }
}
