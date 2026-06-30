/**
 * Google Maps ナビ URL 生成（fallback 付き）
 * 優先順位: 承認済みピン座標 > placeId > lat/lng > 正規化住所 > 元住所
 */
import type { OverrideInfo } from "@/types/location";

const MAPS_NAV_BASE = "https://www.google.com/maps/dir/?api=1";

export function buildCoordinateNavigationUrl(lat: number, lng: number): string {
  return `${MAPS_NAV_BASE}&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
}

export function buildAddressNavigationUrl(address: string): string {
  return `${MAPS_NAV_BASE}&destination=${encodeURIComponent(address)}&travelmode=driving&dir_action=navigate`;
}

export function buildManualPinNavigationUrl(lat: number, lng: number): string {
  return buildCoordinateNavigationUrl(lat, lng);
}

export function buildPlaceIdNavigationUrl(placeId: string): string {
  return `${MAPS_NAV_BASE}&destination_place_id=${placeId}&travelmode=driving&dir_action=navigate`;
}

/**
 * 最適なナビ URL を返す
 * override（承認済み）> placeId > lat/lng > 住所
 */
export function buildBestNavigationUrl(params: {
  address: string | null;
  lat: number | null;
  lng: number | null;
  placeId?: string | null;
  override?: OverrideInfo | null;
}): string {
  const { address, lat, lng, placeId, override } = params;

  // 1. 承認済みピン座標
  if (override?.status === "approved" && override.lat && override.lng) {
    return buildManualPinNavigationUrl(override.lat, override.lng);
  }

  // 2. placeId
  if (placeId) {
    return buildPlaceIdNavigationUrl(placeId);
  }

  // 3. lat/lng
  if (lat && lng) {
    return buildCoordinateNavigationUrl(lat, lng);
  }

  // 4. 住所
  if (address) {
    return buildAddressNavigationUrl(address);
  }

  return "https://www.google.com/maps";
}

/** コピー用住所文字列を返す */
export function buildCopyableAddress(params: {
  address: string | null;
  postalCode?: string | null;
  override?: OverrideInfo | null;
}): string {
  const { address, postalCode } = params;
  const parts = [postalCode ? `〒${postalCode}` : null, address].filter(Boolean);
  return parts.join(" ") || "";
}
