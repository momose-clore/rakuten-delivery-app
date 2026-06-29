const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * 住所から緯度経度を取得する。
 * 失敗時は null を返す（例外を投げない）。
 * 住所をログに出力しない。
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

    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;

    const location = data.results[0].geometry.location;
    return { lat: location.lat, lng: location.lng };
  } catch {
    return null;
  }
}
