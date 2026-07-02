/**
 * 予測値 warning の優先度定数
 * 優先度が高いほど先に表示・先に処理する
 */
import type { AnyWarning } from "@/types/prediction";

/** warning 優先度マップ（数値が大きいほど優先） */
export const WARNING_PRIORITY: Record<AnyWarning, number> = {
  // 最高優先（即時対応必須）
  GEOCODE_FAILED:           100,
  COORDINATE_MISSING:       95,
  COORDINATE_OUT_OF_AREA:   90,
  // COORDINATE_OUTSIDE_JAPAN はAddressWarning（types/location.ts）のみ定義・ここでは除外

  // 高優先（確定前に確認必須）
  OCR_LOW_CONFIDENCE:       80,
  GEOCODE_LOW_CONFIDENCE:   75,
  OCR_FIELD_ESTIMATED:      70,

  // 中優先（自動補正系）
  OCR_COUNT_AUTO_FILLED:    60,
  OCR_AUTO_RESCUED_VALUE:   55,
  OCR_DISPATCH_NO_CORRECTED: 50,
  OCR_ADDRESS_AUTO_NORMALIZED: 45,
  OCR_PHONE_NORMALIZED:     40,

  // 低優先（情報提供）
  GEOCODE_ESTIMATED:        35,
  MANUAL_OVERRIDE_AVAILABLE: 30,
  APPROVED_OVERRIDE_USED:   25,
  HISTORY_MATCH_USED:       20,
  HISTORY_MATCH_PARTIAL:    15,
  BUILDING_NAME_MISMATCH:   10,
  ROOM_NO_DIFFERENT:        8,
  SIMILAR_ADDRESS_FOUND:    5,
};

/** warnings を優先度降順に並び替える */
export function sortWarningsByPriority(warnings: AnyWarning[]): AnyWarning[] {
  return [...warnings].sort(
    (a, b) => (WARNING_PRIORITY[b] ?? 0) - (WARNING_PRIORITY[a] ?? 0)
  );
}

/** 最高優先度の warning を返す */
export function getHighestPriorityWarning(
  warnings: AnyWarning[]
): AnyWarning | null {
  if (warnings.length === 0) return null;
  return sortWarningsByPriority(warnings)[0] ?? null;
}

/** 確定前に警告が必要か判定する（優先度 70 以上） */
export function requiresConfirmationWarning(warnings: AnyWarning[]): boolean {
  return warnings.some((w) => (WARNING_PRIORITY[w] ?? 0) >= 70);
}
