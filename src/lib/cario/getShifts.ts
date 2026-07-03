import type { CarioShift } from "./types";
import { carioGet, isCarioApiConfigured, CarioApiError } from "./client";
import { mapApiShifts } from "./mapper";

/**
 * CARIO から対象日のシフト一覧を取得する。
 *
 * CARIO_API_BASE_URL / CARIO_API_KEY が設定されている場合 → REST API を使用
 * 未設定の場合 → モックデータにフォールバック（開発・動作確認用）
 *
 * TODO: CARIO実API仕様確定後に以下を確認・調整
 *   - エンドポイント（現在: /shifts）
 *   - クエリパラメータ（date のフォーマット）
 *   - レスポンス構造（mapper.ts の mapApiShift を調整）
 */
export async function fetchCarioShifts(date: Date): Promise<CarioShift[]> {
  const workDate = date.toISOString().split("T")[0]; // "YYYY-MM-DD"

  if (isCarioApiConfigured()) {
    try {
      // 実API: GET /api/external/rakuten/shift-requests?from&to → { from, to, requests: [...] }
      const res = await carioGet<{ requests?: unknown[] } | unknown[]>(
        `/api/external/rakuten/shift-requests?from=${workDate}&to=${workDate}`
      );
      const records = Array.isArray(res) ? res : (res.requests ?? []);
      return mapApiShifts(records as Record<string, unknown>[]);
    } catch (err) {
      if (err instanceof CarioApiError) {
        throw err;
      }
      console.error("[CARIO getShifts] 予期しないエラー:", err instanceof Error ? err.message : "unknown");
      throw err;
    }
  }

  // ── 開発用モックデータ（API 未設定時のフォールバック）────────────────
  console.warn("[CARIO] CARIO_API_BASE_URL が未設定のためモックデータを使用しています");
  return MOCK_SHIFTS.map((s) => ({ ...s, workDate }));
}

const MOCK_SHIFTS = [
  { carioDriverId: "CARIO-001", workDate: "", startTime: "07:00", endTime: "17:00", status: "CONFIRMED" as const },
  { carioDriverId: "CARIO-002", workDate: "", startTime: "07:00", endTime: "17:00", status: "CONFIRMED" as const },
  { carioDriverId: "CARIO-003", workDate: "", startTime: "08:00", endTime: "18:00", status: "TENTATIVE" as const },
  { carioDriverId: "CARIO-004", workDate: "", startTime: "07:30", endTime: "17:30", status: "CONFIRMED" as const },
  { carioDriverId: "CARIO-005", workDate: "", startTime: "08:00", endTime: "18:00", status: "TENTATIVE" as const },
];
