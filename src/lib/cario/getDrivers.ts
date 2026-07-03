import type { CarioDriver } from "./types";
import { carioGet, isCarioApiConfigured, CarioApiError } from "./client";
import { mapApiDrivers } from "./mapper";

/**
 * CARIO からドライバー一覧を取得する。
 *
 * CARIO_API_BASE_URL / CARIO_API_KEY が設定されている場合 → REST API を使用
 * 未設定の場合 → モックデータにフォールバック（開発・動作確認用）
 *
 * TODO: CARIO実API仕様確定後に以下を確認・調整
 *   - エンドポイント（現在: /drivers）
 *   - クエリパラメータ（日付絞り込みがあるか）
 *   - レスポンス構造（mapper.ts の mapApiDriver を調整）
 */
export async function fetchCarioDrivers(date: Date): Promise<CarioDriver[]> {
  if (isCarioApiConfigured()) {
    try {
      // 実API: GET /api/external/rakuten/drivers → { drivers: [...] }
      // ?all=1 で楽天現場所属に限らず全DAを取得（既定は現場所属のみ）
      void date; // 実APIは日付で絞り込まない（全DA一覧を返す）
      const res = await carioGet<{ drivers?: unknown[] } | unknown[]>(
        "/api/external/rakuten/drivers"
      );
      const records = Array.isArray(res) ? res : (res.drivers ?? []);
      return mapApiDrivers(records as Record<string, unknown>[]);
    } catch (err) {
      if (err instanceof CarioApiError) {
        // AUTH / TIMEOUT / SERVER エラーは呼び出し元に伝播させる
        throw err;
      }
      // その他の予期しないエラーはログのみ（個人情報は含まない）
      console.error("[CARIO getDrivers] 予期しないエラー:", err instanceof Error ? err.message : "unknown");
      throw err;
    }
  }

  // ── 開発用モックデータ（API 未設定時のフォールバック）────────────────
  console.warn("[CARIO] CARIO_API_BASE_URL が未設定のためモックデータを使用しています");
  return MOCK_DRIVERS;
}

const MOCK_DRIVERS: CarioDriver[] = [
  { carioDriverId: "CARIO-001", name: "田中 太郎", phone: "09011112222", companyName: "田中運輸", area: "埼玉北", vehicleId: "001" },
  { carioDriverId: "CARIO-002", name: "佐藤 次郎", phone: "09033334444", companyName: "田中運輸", area: "埼玉南", vehicleId: "002" },
  { carioDriverId: "CARIO-003", name: "鈴木 三郎", phone: "09055556666", companyName: "鈴木配送", area: "東京東", vehicleId: "003" },
  { carioDriverId: "CARIO-004", name: "高橋 四郎", phone: "09077778888", companyName: "鈴木配送", area: "東京西", vehicleId: "004" },
  { carioDriverId: "CARIO-005", name: "渡辺 五郎", phone: "09099990000", companyName: "渡辺物流", area: "埼玉北", vehicleId: "005" },
];
