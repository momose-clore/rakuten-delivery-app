/**
 * 予測値・推定値の誤適用対策
 * source / confidence / status / warning を値ごとに管理する
 */

/** 値の出どころ */
export type ValueSource =
  | "OCR_RAW"
  | "OCR_AUTO_RESCUED"
  | "IMPORT_FILE"
  | "PDF_TEXT"
  | "CSV"
  | "EXCEL"
  | "PASTE"
  | "GOOGLE_GEOCODE"
  | "LOCATION_OVERRIDE"
  | "HISTORY_MATCH"
  | "DRIVER_SUBMITTED"
  | "ADMIN_APPROVED"
  | "MANUAL_EDIT"
  | "SYSTEM_ESTIMATED";

/** 値の信頼度 */
export type ValueConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

/** 値のステータス */
export type ValueStatus =
  | "RAW"
  | "ESTIMATED"
  | "AUTO_RESCUED"
  | "NEEDS_REVIEW"
  | "CONFIRMED"
  | "MANUAL_FIXED"
  | "ADMIN_APPROVED"
  | "REJECTED";

/** OCR予測値の警告コード */
export type PredictionWarning =
  | "OCR_FIELD_ESTIMATED"
  | "OCR_AUTO_RESCUED_VALUE"
  | "OCR_LOW_CONFIDENCE"
  | "OCR_COUNT_AUTO_FILLED"
  | "OCR_ADDRESS_AUTO_NORMALIZED"
  | "OCR_DISPATCH_NO_CORRECTED"
  | "OCR_PHONE_NORMALIZED";

/** Geocoding予測値の警告コード */
export type GeocodeWarning =
  | "GEOCODE_ESTIMATED"
  | "GEOCODE_LOW_CONFIDENCE"
  | "GEOCODE_FAILED"
  | "COORDINATE_MISSING"
  | "COORDINATE_OUT_OF_AREA"
  | "MANUAL_OVERRIDE_AVAILABLE"
  | "APPROVED_OVERRIDE_USED";

/** 履歴マッチの警告コード */
export type HistoryMatchWarning =
  | "HISTORY_MATCH_USED"
  | "HISTORY_MATCH_PARTIAL"
  | "BUILDING_NAME_MISMATCH"
  | "ROOM_NO_DIFFERENT"
  | "SIMILAR_ADDRESS_FOUND";

export type AnyWarning = PredictionWarning | GeocodeWarning | HistoryMatchWarning;

/** フィールドごとのソース・ステータスマップ */
export type FieldSourceMap = Partial<Record<string, ValueSource>>;
export type FieldStatusMap = Partial<Record<string, ValueStatus>>;

/** 信頼度ラベル */
export const CONFIDENCE_LABELS: Record<ValueConfidence, string> = {
  HIGH:    "高信頼",
  MEDIUM:  "中信頼",
  LOW:     "低信頼",
  UNKNOWN: "要確認",
};

/** ステータスラベル */
export const STATUS_LABELS: Record<ValueStatus, string> = {
  RAW:            "OCR生値",
  ESTIMATED:      "推定値",
  AUTO_RESCUED:   "自動補正",
  NEEDS_REVIEW:   "要確認",
  CONFIRMED:      "確定済み",
  MANUAL_FIXED:   "手動修正済み",
  ADMIN_APPROVED: "承認済み",
  REJECTED:       "却下",
};

/** ソースラベル */
export const SOURCE_LABELS: Record<ValueSource, string> = {
  OCR_RAW:           "OCR生値",
  OCR_AUTO_RESCUED:  "自動救済",
  IMPORT_FILE:       "ファイル取込",
  PDF_TEXT:          "PDFテキスト",
  CSV:               "CSV",
  EXCEL:             "Excel",
  PASTE:             "貼り付け",
  GOOGLE_GEOCODE:    "Google Geocoding",
  LOCATION_OVERRIDE: "修正ピン",
  HISTORY_MATCH:     "過去履歴",
  DRIVER_SUBMITTED:  "ドライバー申請",
  ADMIN_APPROVED:    "管理者承認済み",
  MANUAL_EDIT:       "手動修正",
  SYSTEM_ESTIMATED:  "システム推定",
};

/** ADMIN_APPROVED / MANUAL_FIXED → 確定値扱い */
export function isConfirmedValue(status: ValueStatus): boolean {
  return status === "CONFIRMED" || status === "ADMIN_APPROVED" || status === "MANUAL_FIXED";
}

/** ADMIN_APPROVED / MANUAL_FIXED → 自動上書き禁止 */
export function isOverwriteProtected(status: ValueStatus): boolean {
  return status === "ADMIN_APPROVED" || status === "MANUAL_FIXED";
}

/** 座標の UI バッジ種別 */
export type CoordinateBadgeType =
  | "approved"   // 承認済みピン（確認済み）
  | "estimated"  // Google Geocoding推定
  | "missing"    // 座標なし
  | "none";      // バッジ不要
