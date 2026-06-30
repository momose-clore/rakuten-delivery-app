import type { AddressConfidence, AddressWarning, AddressConfidenceResult } from "@/types/location";

const JAPAN_LAT = { min: 24, max: 46 };
const JAPAN_LNG = { min: 122, max: 154 };

interface ConfidenceInput {
  address: string | null;
  lat: number | null;
  lng: number | null;
  hasApprovedOverride?: boolean;
}

export function assessAddressConfidence(input: ConfidenceInput): AddressConfidenceResult {
  const warnings: AddressWarning[] = [];
  const hasOverride = !!input.hasApprovedOverride;

  // 修正ピン承認済みなら最高信頼度
  if (hasOverride) {
    return { confidence: "override", warnings: ["MANUAL_OVERRIDE_AVAILABLE"], hasOverride };
  }

  const addr = input.address ?? "";

  // 住所長さチェック
  if (addr.length < 5) warnings.push("ADDRESS_TOO_SHORT");

  // 番地なし
  if (!/\d/.test(addr) && addr.length > 0) warnings.push("ADDRESS_NO_BLOCK_NUMBER");

  // 建物名のみ
  if (/マンション|ビル|ハイツ|アパート/.test(addr) && !/[市区町村]/.test(addr)) {
    warnings.push("ADDRESS_BUILDING_ONLY");
  }

  // 座標チェック
  if (input.lat === null || input.lng === null) {
    warnings.push("COORDINATE_MISSING");
    warnings.push("GEOCODE_FAILED");
  } else {
    // 日本国外チェック
    if (input.lat < JAPAN_LAT.min || input.lat > JAPAN_LAT.max ||
        input.lng < JAPAN_LNG.min || input.lng > JAPAN_LNG.max) {
      warnings.push("COORDINATE_OUTSIDE_JAPAN");
    }
  }

  // 信頼度判定
  const hasCritical = warnings.some((w) =>
    ["COORDINATE_MISSING", "GEOCODE_FAILED", "COORDINATE_OUTSIDE_JAPAN", "ADDRESS_TOO_SHORT"].includes(w)
  );
  const hasModerate = warnings.some((w) =>
    ["ADDRESS_NO_BLOCK_NUMBER", "ADDRESS_BUILDING_ONLY"].includes(w)
  );

  let confidence: AddressConfidence = "high";
  if (hasCritical) confidence = "low";
  else if (hasModerate) confidence = "medium";

  return { confidence, warnings, hasOverride };
}
