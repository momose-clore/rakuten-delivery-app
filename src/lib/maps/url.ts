import { WAREHOUSE } from "./warehouse";

const MAPS_DIR_BASE = "https://www.google.com/maps/dir/";
const MAX_WAYPOINTS = 10; // Google Maps 無料版の経由地上限

interface Waypoint {
  lat: number;
  lng: number;
}

/**
 * Google Maps 経路 URL を生成する（APIキーを含まない）。
 * waypoints が MAX_WAYPOINTS を超える場合は複数 URL に分割する。
 *
 * @param waypoints 配送先の緯度経度リスト（配送順）
 * @param returnToWarehouse 最後に倉庫へ戻るかどうか
 * @returns Google Maps 経路 URL の配列
 */
export function buildMapsUrls(
  waypoints: Waypoint[],
  returnToWarehouse: boolean
): string[] {
  if (waypoints.length === 0) return [];

  const origin = `${WAREHOUSE.lat},${WAREHOUSE.lng}`;
  const warehousePoint = `${WAREHOUSE.lat},${WAREHOUSE.lng}`;

  // MAX_WAYPOINTS 単位でチャンク分割
  const chunks: Waypoint[][] = [];
  for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS) {
    chunks.push(waypoints.slice(i, i + MAX_WAYPOINTS));
  }

  return chunks.map((chunk, idx) => {
    const isLast = idx === chunks.length - 1;

    // 2チャンク目以降の起点は前チャンクの最後の地点
    const chunkOrigin =
      idx === 0
        ? origin
        : `${chunks[idx - 1][chunks[idx - 1].length - 1].lat},${chunks[idx - 1][chunks[idx - 1].length - 1].lng}`;

    const points = chunk.map((p) => `${p.lat},${p.lng}`);

    // 最終チャンクで倉庫戻りの場合、終点を倉庫にする
    const destination =
      isLast && returnToWarehouse ? warehousePoint : points[points.length - 1];
    const stops = isLast && returnToWarehouse ? points : points.slice(0, -1);

    const parts = [chunkOrigin, ...stops, destination];
    return MAPS_DIR_BASE + parts.join("/");
  });
}
