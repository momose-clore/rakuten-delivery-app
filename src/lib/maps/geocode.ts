const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** ROOFTOP=高精度 / RANGE_INTERPOLATED=補間 / GEOMETRIC_CENTER=中心 / APPROXIMATE=近似 */
  locationType: "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE" | null;
}

/**
 * 住所から緯度経度を取得する。
 * 失敗時は null を返す（例外を投げない）。
 * 住所をログに出力しない。
 * 返却座標は常に ESTIMATED 扱い（ADMIN_APPROVED override が優先される）。
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("[geocode] GOOGLE_MAPS_API_KEY が設定されていません");
    return null;
  }

  try {
    const url = new URL(GEOCODE_ENDPOINT);
    url.searchParams.set("address", address);
    url.searchParams.set("language", "ja");
    url.searchParams.set("region", "JP");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json() as {
      status: string;
      results?: { geometry: { location: { lat: number; lng: number }; location_type: string } }[];
    };
    if (data.status !== "OK" || !data.results?.[0]) return null;

    const result = data.results[0];
    const location = result.geometry.location;
    const locationType = result.geometry.location_type as GeocodeResult["locationType"] ?? null;

    return { lat: location.lat, lng: location.lng, locationType };
  } catch {
    return null;
  }
}
