/**
 * 楽天 CARIO assignments API から取込データを取得する
 *
 * API設定済み → fetchRakutenAssignments() を使用
 * API未設定   → モックデータにフォールバック（開発環境のみ）
 */
import { fetchRakutenAssignments, isCarioApiConfigured, CarioApiError } from "./client";
import { mapRakutenAssignmentsResponse } from "./mapper";
import type { CarioDriver, CarioShift, CarioAssignment } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 一過性エラー（TIMEOUT/SERVER/NETWORK）は指数バックオフで再試行。AUTHは即時失敗。 */
async function fetchWithRetry(
  params: { from: string; to: string; siteId?: string },
  maxRetries = 2
): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchRakutenAssignments(params);
    } catch (err) {
      lastErr = err;
      const transient =
        err instanceof CarioApiError &&
        (err.type === "TIMEOUT" || err.type === "SERVER" || err.type === "NETWORK");
      if (!transient || attempt === maxRetries) throw err;
      await sleep(300 * 2 ** attempt); // 300ms, 600ms
    }
  }
  throw lastErr;
}

export interface RakutenAssignmentsResult {
  drivers:      CarioDriver[];
  shifts:       CarioShift[];
  assignments:  CarioAssignment[];
  warnings:     string[];
  responseShape: string;
  usedMock:     boolean;
}

/**
 * 指定期間の assignments を取得する
 *
 * @param from  開始日（YYYY-MM-DD）
 * @param to    終了日（YYYY-MM-DD）、省略時は from と同日
 */
export async function fetchAssignmentsForRange(
  from: string,
  to?: string,
  siteId?: string
): Promise<RakutenAssignmentsResult> {
  const toDate = to ?? from;

  if (!isCarioApiConfigured()) {
    // モックデータ（開発環境用）
    return {
      ...MOCK_RESULT,
      usedMock: true,
    };
  }

  const raw = await fetchWithRetry({ from, to: toDate, siteId });
  const mapped = mapRakutenAssignmentsResponse(raw);

  return { ...mapped, usedMock: false };
}

/** 単日取込のショートハンド */
export async function fetchAssignmentsForDate(
  date: Date
): Promise<RakutenAssignmentsResult> {
  const dateStr = date.toISOString().split("T")[0]!;
  return fetchAssignmentsForRange(dateStr);
}

// ── 開発用モックデータ ────────────────────────────────────────────────────

const MOCK_RESULT: RakutenAssignmentsResult = {
  usedMock: true,
  responseShape: "mock",
  warnings: [],
  assignments: [],
  drivers: [
    { carioDriverId: "CARIO-001", name: "テストドライバー1", phone: null, companyName: "テスト物流", area: "A", vehicleId: null },
    { carioDriverId: "CARIO-002", name: "テストドライバー2", phone: null, companyName: "テスト物流", area: "B", vehicleId: null },
    { carioDriverId: "CARIO-003", name: "テストドライバー3", phone: null, companyName: "テスト運輸", area: "A", vehicleId: null },
    { carioDriverId: "CARIO-004", name: "テストドライバー4", phone: null, companyName: "テスト運輸", area: "C", vehicleId: null },
    { carioDriverId: "CARIO-005", name: "テストドライバー5", phone: null, companyName: "テスト運輸", area: "B", vehicleId: null },
  ],
  shifts: [
    { carioDriverId: "CARIO-001", workDate: "", startTime: "07:00", endTime: "17:00", status: "CONFIRMED" },
    { carioDriverId: "CARIO-002", workDate: "", startTime: "07:00", endTime: "17:00", status: "CONFIRMED" },
    { carioDriverId: "CARIO-003", workDate: "", startTime: "08:00", endTime: "18:00", status: "TENTATIVE" },
    { carioDriverId: "CARIO-004", workDate: "", startTime: "07:30", endTime: "17:30", status: "CONFIRMED" },
    { carioDriverId: "CARIO-005", workDate: "", startTime: "08:00", endTime: "18:00", status: "TENTATIVE" },
  ],
};
