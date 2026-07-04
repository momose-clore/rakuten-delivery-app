/**
 * 美女木 積み込み拠点
 *
 * 実住所: 埼玉県戸田市美女木7-18-6（riku 確定・2026-07-04）。
 * 座標は国土地理院ジオコーダで取得（美女木七丁目18番・番地精度）。
 * 変更時はここだけ更新すれば live-map / ダッシュボード / ルート起点に反映される。
 */
export const WAREHOUSE = {
  name: "美女木 積み込み拠点",
  address: "埼玉県戸田市美女木7-18-6",
  lat: 35.824005,
  lng: 139.636612,
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=35.824005,139.636612",
} as const;
