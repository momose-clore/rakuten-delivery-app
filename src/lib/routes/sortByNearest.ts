export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
}

/** ハバーサイン公式による距離計算（km） */
function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

/**
 * 最近隣法で配送順を決定する。
 * @param origin 起点（美女木 積み込み拠点）
 * @param points 配送先リスト
 * @returns 配送順に並んだ points（route_order = index + 1）
 */
export function sortByNearest(origin: GeoPoint, points: GeoPoint[]): GeoPoint[] {
  if (points.length === 0) return [];

  const remaining = [...points];
  const sorted: GeoPoint[] = [];
  let current: GeoPoint = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let minDist = distanceKm(current, remaining[0]);

    for (let i = 1; i < remaining.length; i++) {
      const d = distanceKm(current, remaining[i]);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    current = remaining[nearestIdx];
    sorted.push(current);
    remaining.splice(nearestIdx, 1);
  }

  return sorted;
}

/**
 * 起点固定の開いた経路（origin → route[0] → … → route[n-1]）の総距離（km）。
 * 倉庫戻りは route_order には影響しないため、開いた経路として評価する。
 */
function pathDistanceKm(origin: GeoPoint, route: GeoPoint[]): number {
  if (route.length === 0) return 0;
  let total = distanceKm(origin, route[0]);
  for (let i = 0; i < route.length - 1; i++) {
    total += distanceKm(route[i], route[i + 1]);
  }
  return total;
}

/**
 * 2-opt 局所探索で配送順を改善する（起点固定）。
 * 最近隣法の「部分最適」を、辺の交差を解消して短縮する。外部API不要・純計算。
 * @param maxIterations 収束しない場合の保険上限（既定 60）
 */
export function twoOptImprove(
  origin: GeoPoint,
  route: GeoPoint[],
  maxIterations = 60
): GeoPoint[] {
  const n = route.length;
  if (n < 4) return route; // 3点以下は 2-opt の効果なし

  let best = [...route];
  let bestDist = pathDistanceKm(origin, best);
  let improved = true;
  let iter = 0;

  while (improved && iter < maxIterations) {
    improved = false;
    iter++;
    // セグメント [i..j] を反転して短くなれば採用
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const dist = pathDistanceKm(origin, candidate);
        if (dist < bestDist - 1e-9) {
          best = candidate;
          bestDist = dist;
          improved = true;
        }
      }
    }
  }

  return best;
}

/**
 * 配送順を決定する（最近隣法 → 2-opt 改善）。
 * 直線距離ベースだが、貪欲法単体より総距離を短縮できる。外部API・キー不要。
 * ※ 道路ベースの最適化（OpenRouteService等）は別途、座標が揃った後段で差し替え可能。
 */
export function optimizeRoute(origin: GeoPoint, points: GeoPoint[]): GeoPoint[] {
  return twoOptImprove(origin, sortByNearest(origin, points));
}
