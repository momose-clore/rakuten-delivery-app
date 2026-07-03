/**
 * CARIO 現場一覧（/sites）と シフト希望（/shift-requests）の取得。
 *
 * 受信専用（GETのみ）。API未設定時は空配列を返す（呼び出し側でモード判定）。
 */
import { carioGet, isCarioApiConfigured } from "./client";
import type { CarioSite, CarioShiftRequest } from "./types";

interface RawSite {
  id?: unknown;
  name?: unknown;
  flow_type?: unknown;
  wave_count?: unknown;
  client?: unknown;
}

/** GET /api/external/rakuten/sites → { sites: [...] } */
export async function fetchCarioSites(): Promise<CarioSite[]> {
  if (!isCarioApiConfigured()) return [];
  const res = await carioGet<{ sites?: RawSite[] } | RawSite[]>(
    "/api/external/rakuten/sites"
  );
  const rows = Array.isArray(res) ? res : (res.sites ?? []);
  return rows.map((s) => ({
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    flowType: s.flow_type != null ? String(s.flow_type) : null,
    waveCount: typeof s.wave_count === "number" ? s.wave_count : null,
    client: s.client != null ? String(s.client) : null,
  })).filter((s) => s.id !== "");
}

/**
 * GET /api/external/rakuten/shift-requests?from&to → { from, to, requests: [...] }
 * ※ 現状 requests は空配列。実フィールド確定まで生データを raw に保持する。
 */
export async function fetchCarioShiftRequests(
  from: string,
  to?: string
): Promise<CarioShiftRequest[]> {
  if (!isCarioApiConfigured()) return [];
  const toDate = to ?? from;
  const res = await carioGet<{ requests?: Record<string, unknown>[] }>(
    `/api/external/rakuten/shift-requests?from=${from}&to=${toDate}`
  );
  const rows = Array.isArray(res.requests) ? res.requests : [];
  return rows.map((r) => ({
    driverId: String(
      (r.driver as { id?: unknown } | undefined)?.id ?? r.driver_id ?? ""
    ),
    driverName:
      ((r.driver as { name?: unknown } | undefined)?.name as string | undefined) ??
      (r.driver_name as string | undefined) ??
      null,
    workDate: String(r.work_date ?? r.date ?? ""),
    raw: r,
  }));
}
