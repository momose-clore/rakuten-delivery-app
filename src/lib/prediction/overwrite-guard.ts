/**
 * 上書き防止ガード
 * ADMIN_APPROVED / MANUAL_FIXED の値を自動処理で上書きしない
 */
import { isOverwriteProtected } from "@/types/prediction";
import type { ValueStatus } from "@/types/prediction";

export interface OverwriteCheckResult {
  blocked: boolean;
  reason: string | null;
  existingStatus: ValueStatus | null;
}

/** 座標の自動上書きをブロックすべきか判定 */
export function shouldBlockCoordinateOverwrite(
  currentStatus: string | null | undefined
): OverwriteCheckResult {
  if (!currentStatus) return { blocked: false, reason: null, existingStatus: null };
  const status = currentStatus as ValueStatus;
  if (isOverwriteProtected(status)) {
    return {
      blocked: true,
      reason: `座標は ${status} のため自動Geocodeをスキップ`,
      existingStatus: status,
    };
  }
  return { blocked: false, reason: null, existingStatus: status };
}

/** フィールドの自動上書きをブロックすべきか判定 */
export function shouldBlockFieldOverwrite(
  fieldStatusJson: string | null | undefined,
  fieldName: string
): OverwriteCheckResult {
  if (!fieldStatusJson) return { blocked: false, reason: null, existingStatus: null };
  try {
    const map = JSON.parse(fieldStatusJson) as Record<string, string>;
    const status = map[fieldName] as ValueStatus | undefined;
    if (status && isOverwriteProtected(status)) {
      return {
        blocked: true,
        reason: `${fieldName} は ${status} のため自動上書きをスキップ`,
        existingStatus: status,
      };
    }
  } catch { /* ignore */ }
  return { blocked: false, reason: null, existingStatus: null };
}
