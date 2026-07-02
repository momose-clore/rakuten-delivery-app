/**
 * 予測値メタデータ構築ユーティリティ
 */
import type {
  ValueSource, ValueStatus, ValueConfidence,
  AnyWarning, FieldSourceMap, FieldStatusMap,
  PredictionWarning,
} from "@/types/prediction";

// ─── JSON パーサー ───────────────────────────────

export function parseFieldSourceJson(json: string | null): FieldSourceMap {
  if (!json) return {};
  try { return JSON.parse(json) as FieldSourceMap; }
  catch { return {}; }
}

export function parseFieldStatusJson(json: string | null): FieldStatusMap {
  if (!json) return {};
  try { return JSON.parse(json) as FieldStatusMap; }
  catch { return {}; }
}

export function parsePredictionWarnings(json: string | null): AnyWarning[] {
  if (!json) return [];
  try { return JSON.parse(json) as AnyWarning[]; }
  catch { return []; }
}

// ─── OCR取込メタデータ ───────────────────────────

export interface OcrAutoRescueFlags {
  dispatchKeyCorrected: boolean;
  invoiceNoExtracted: boolean;
  phoneMoved: boolean;
  addressNormalized: boolean;
  totalCountFilled: boolean;
  historyApplied: boolean;
}

export function buildOcrFieldSources(
  autoRescued: boolean,
  flags: OcrAutoRescueFlags
): FieldSourceMap {
  const base: ValueSource = autoRescued ? "OCR_AUTO_RESCUED" : "OCR_RAW";
  return {
    dispatchKey:       flags.dispatchKeyCorrected ? "OCR_AUTO_RESCUED" : "OCR_RAW",
    invoiceNo:         flags.invoiceNoExtracted   ? "OCR_AUTO_RESCUED" : "OCR_RAW",
    address:           flags.addressNormalized    ? "OCR_AUTO_RESCUED" : "OCR_RAW",
    customerPhone:     flags.phoneMoved           ? "OCR_AUTO_RESCUED" : "OCR_RAW",
    normalOriconCount: base,
    coolerBoxCount:    base,
    caseCount:         base,
    totalCount:        flags.totalCountFilled     ? "OCR_AUTO_RESCUED" : base,
    customerName:      "OCR_RAW",
  };
}

export function buildOcrFieldStatuses(
  confidence: "high" | "medium" | "low",
  autoRescued: boolean,
  notes: string[]
): FieldStatusMap {
  const needsReview = notes.includes("NEEDS_REVIEW");
  const base: ValueStatus = needsReview ? "NEEDS_REVIEW"
    : autoRescued                        ? "AUTO_RESCUED"
    : confidence === "high"              ? "RAW"
    : "ESTIMATED";
  return {
    dispatchKey: base, invoiceNo: base, address: base,
    customerPhone: base, customerName: base,
    normalOriconCount: base, coolerBoxCount: base,
    caseCount: base, totalCount: base,
  };
}

export function buildOcrPredictionWarnings(
  autoRescued: boolean,
  flags: OcrAutoRescueFlags,
  confidence: "high" | "medium" | "low"
): PredictionWarning[] {
  const w: PredictionWarning[] = [];
  if (autoRescued)                  w.push("OCR_AUTO_RESCUED_VALUE");
  if (flags.totalCountFilled)       w.push("OCR_COUNT_AUTO_FILLED");
  if (confidence === "low")         w.push("OCR_LOW_CONFIDENCE");
  if (flags.dispatchKeyCorrected)   w.push("OCR_DISPATCH_NO_CORRECTED");
  if (flags.phoneMoved)             w.push("OCR_PHONE_NORMALIZED");
  if (flags.addressNormalized)      w.push("OCR_ADDRESS_AUTO_NORMALIZED");
  return w;
}

// ─── Geocoding メタデータ ────────────────────────

export function buildGeocodeCoordinateMeta(): {
  coordinateSource: ValueSource;
  coordinateStatus: ValueStatus;
  coordinateConfidence: ValueConfidence;
} {
  return {
    coordinateSource:     "GOOGLE_GEOCODE",
    coordinateStatus:     "ESTIMATED",
    coordinateConfidence: "MEDIUM",
  };
}

export function buildApprovedOverrideCoordinateMeta(): {
  coordinateSource: ValueSource;
  coordinateStatus: ValueStatus;
  coordinateConfidence: ValueConfidence;
} {
  return {
    coordinateSource:     "LOCATION_OVERRIDE",
    coordinateStatus:     "ADMIN_APPROVED",
    coordinateConfidence: "HIGH",
  };
}

// ─── mergeFieldStatuses ───────────────────────────

/** OCR由来フィールド一覧 */
export const OCR_DERIVED_FIELDS = [
  "dispatchKey", "invoiceNo", "customerName", "customerPhone",
  "address", "normalOriconCount", "coolerBoxCount", "caseCount",
  "totalCount", "memo",
] as const;

export type OcrDerivedField = typeof OCR_DERIVED_FIELDS[number];

/**
 * OCR由来フィールドのみに絞り込む
 * 地図系・メモ系フィールドは対象外
 */
export function filterOcrFields<T extends FieldSourceMap | FieldStatusMap>(map: T): Partial<T> {
  const filtered: Partial<T> = {};
  for (const field of OCR_DERIVED_FIELDS) {
    if (map[field] !== undefined) {
      (filtered as Record<string, unknown>)[field] = map[field];
    }
  }
  return filtered;
}

/**
 * フィールドステータスをマージする（上書き保護付き）
 * ADMIN_APPROVED / MANUAL_FIXED のフィールドは上書きしない
 */
export function mergeFieldStatuses(
  existing: string | null | undefined,
  proposed: FieldStatusMap
): FieldStatusMap {
  const existingMap = parseFieldStatusJson(existing ?? null);
  const merged: FieldStatusMap = { ...proposed };

  for (const [field, existingStatus] of Object.entries(existingMap)) {
    if (!existingStatus) continue;
    // ADMIN_APPROVED / MANUAL_FIXED は提案値で上書きしない
    if (existingStatus === "ADMIN_APPROVED" || existingStatus === "MANUAL_FIXED") {
      merged[field] = existingStatus;
    }
  }

  return merged;
}

/**
 * フィールドソースをマージする（上書き保護付き）
 */
export function mergeFieldSources(
  existing: string | null | undefined,
  proposed: FieldSourceMap
): FieldSourceMap {
  const existingStatusMap = parseFieldStatusJson(existing ?? null);
  const merged: FieldSourceMap = { ...proposed };

  // ステータスが保護されているフィールドのソースは変更しない
  for (const [field, existingStatus] of Object.entries(existingStatusMap)) {
    if (existingStatus === "ADMIN_APPROVED" || existingStatus === "MANUAL_FIXED") {
      // proposed には既存ソースがない可能性があるが、保護フィールドは MANUAL_EDIT / ADMIN_APPROVED のまま
      if (existingStatus === "ADMIN_APPROVED") merged[field] = "ADMIN_APPROVED";
      if (existingStatus === "MANUAL_FIXED")   merged[field] = "MANUAL_EDIT";
    }
  }

  return merged;
}
