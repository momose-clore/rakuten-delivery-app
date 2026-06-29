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
