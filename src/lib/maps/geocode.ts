import { prisma } from "@/lib/prisma";
import { normalizeAddress, buildLookupKey } from "@/lib/address/address-normalizer";

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
// 国土地理院（GSI）ジオコーディング：APIキー不要・無料・町丁目レベル（番地精度はGoogleに劣る）。
const GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** ROOFTOP=高精度 / RANGE_INTERPOLATED=補間 / GEOMETRIC_CENTER=中心 / APPROXIMATE=近似 */
  locationType: "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE" | null;
  /** 取得元。"gsi" は町丁目レベル＝低精度（要確認ピン候補）。 */
  source?: "google" | "gsi";
}

/** Google Geocoding で1回問い合わせる。住所はログに出さない。 */
async function geocodeGoogle(address: string, apiKey: string): Promise<GeocodeResult | null> {
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
    const locationType = (result.geometry.location_type as GeocodeResult["locationType"]) ?? null;
    return { lat: location.lat, lng: location.lng, locationType, source: "google" };
  } catch {
    return null;
  }
}

/** 国土地理院ジオコーダで1回問い合わせる（無料・キー不要）。住所はログに出さない。 */
async function geocodeGsi(address: string): Promise<GeocodeResult | null> {
  try {
    const url = new URL(GSI_ENDPOINT);
    url.searchParams.set("q", address);
    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json() as { geometry?: { coordinates?: [number, number] } }[];
    const first = Array.isArray(data) ? data[0] : null;
    const coords = first?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;

    const [lng, lat] = coords; // GSI は [経度, 緯度] の順
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng, locationType: null, source: "gsi" };
  } catch {
    return null;
  }
}

/**
 * 住所から緯度経度を取得する。
 * 失敗時は null を返す（例外を投げない）。住所をログに出力しない。
 * 返却座標は常に ESTIMATED 扱い（ADMIN_APPROVED override が優先される）。
 *
 * 精度向上・コスト削減（無料・キー不要・課金ゼロ）:
 *  - D①: 正規化住所キーで DB キャッシュを参照/保存し、同一住所の再変換（Google呼び出し）を避ける。
 *  - D②: 住所を正規化（全角半角統一・建物名除去）してから問い合わせ、ヒット率/精度を上げる。
 *  - D⑤: Google が取得不能なときは国土地理院(GSI)にフォールバック（町丁目レベル・source="gsi"）。
 *  - source / locationType を返すので、呼び出し側は低精度（gsi・APPROXIMATE）を「要確認ピン」に回せる。
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = buildLookupKey(address);

  // D①: キャッシュ参照（障害時は無視して通常経路へ）
  if (key) {
    try {
      const cached = await prisma.geocodeCache.findUnique({ where: { key } });
      if (cached) {
        void prisma.geocodeCache
          .update({ where: { key }, data: { hitCount: { increment: 1 } } })
          .catch(() => {});
        return {
          lat: cached.lat,
          lng: cached.lng,
          locationType: cached.locationType as GeocodeResult["locationType"],
          source: cached.source === "gsi" ? "gsi" : "google",
        };
      }
    } catch {
      /* キャッシュ障害は無視 */
    }
  }

  // D②: 正規化住所（都道府県+市区町村+町名+番地／建物名除外）。空なら生住所。
  const normalized = normalizeAddress(address).normalizedAddress || address;

  let result: GeocodeResult | null = null;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    result =
      (await geocodeGoogle(normalized, apiKey)) ??
      (normalized !== address ? await geocodeGoogle(address, apiKey) : null);
  } else {
    console.error("[geocode] GOOGLE_MAPS_API_KEY が設定されていません");
  }

  // D⑤: Google 失敗時は GSI（無料・キー不要）にフォールバック
  if (!result) {
    result =
      (await geocodeGsi(normalized)) ??
      (normalized !== address ? await geocodeGsi(address) : null);
  }

  // D①: 成功結果をキャッシュ保存（fire-and-forget・失敗は無視）
  if (result && key) {
    void prisma.geocodeCache
      .upsert({
        where: { key },
        create: {
          key,
          lat: result.lat,
          lng: result.lng,
          locationType: result.locationType,
          source: result.source ?? "google",
        },
        update: {
          lat: result.lat,
          lng: result.lng,
          locationType: result.locationType,
          source: result.source ?? "google",
        },
      })
      .catch(() => {});
  }

  return result;
}
