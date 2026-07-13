/**
 * CARIO「稼働者の終了報告（wave完了）」pull クライアント。
 *
 * 実エンドポイント（γ提供仕様・2026-07-13）:
 *   GET /api/rakuten/wave?driver_id=<uuid>
 *     → { report: { work_ended_at } | null,
 *         waves: [{ wave_number, car_number, area, delivery_count,
 *                   first_arrival_time, returned_at, zoubin_requested, zoubin_approved }] }
 *   ※ driver単位・当日(JST)固定・認証不要（Bearerも許容）。site引数なし。
 *
 * 台数確認表への対応:
 *   - waves[] の1レコード = その号車がそのwaveを走った「1台」
 *   - zoubin_approved=true → 増車 / それ以外 → 貼付
 *   - driver列挙は「その日のCARIO配車(assignments)の美女木デポ分」の driver.id から
 *
 * 制約: このAPIは当日しか返さない。過去日は cron の日次スナップショット蓄積でカバー。
 * CARIO側エンドポイント未到達／未設定でも例外にせず available:false を返す。
 */
import { fetchRakutenAssignments, isCarioApiConfigured, CarioApiError } from "./client";
import { jstDateStr } from "./sync";
import { parseWaveNo } from "@/lib/waves";

/** 正規化後の1完了（driver×wave） */
export interface NormalizedCompletion {
  workDate: string;          // "YYYY-MM-DD"
  waveNo: number;            // 1〜6
  vehicleType: "貼付" | "SP" | "増車";
  driverCarioId: string | null;
  driverName: string | null;
  completedAt: string | null; // ISO or "HH:MM"
  count: number | null;       // fallback（driver粒度なら null）
}

export interface WaveCompletionsResult {
  available: boolean;
  reason?: string;
  completions: NormalizedCompletion[];
}

/** 美女木デポ判定（site名に「美女木」を含む） */
function isBijogiSite(name: unknown): boolean {
  return typeof name === "string" && name.includes("美女木");
}

interface RawWave {
  wave_number?: number | string;
  car_number?: string;
  area?: string;
  delivery_count?: number;
  first_arrival_time?: string | null;
  returned_at?: string | null;
  zoubin_requested?: boolean;
  zoubin_approved?: boolean;
}
interface RawWaveResponse {
  report?: { work_ended_at?: string | null } | null;
  waves?: RawWave[];
}

/** CARIO API BaseURL（client.ts と同じ既定） */
function baseUrl(): string {
  return process.env.CARIO_API_BASE_URL ?? "https://cario-app-two.vercel.app";
}

/** 1ドライバーの当日 wave 報告を取得（失敗時は null） */
async function fetchDriverWaves(driverId: string, timeoutMs: number): Promise<RawWaveResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const key = process.env.RAKUTEN_APP_API_KEY ?? process.env.CARIO_API_KEY;
    const res = await fetch(
      `${baseUrl()}/api/rakuten/wave?driver_id=${encodeURIComponent(driverId)}`,
      {
        headers: { Accept: "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        cache: "no-store",
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as RawWaveResponse;
  } catch {
    return null; // 個別ドライバーの失敗は全体を止めない
  } finally {
    clearTimeout(timer);
  }
}

/** その日の美女木デポの CARIO driver.id 一覧を取得 */
async function fetchBijogiDriverIds(date: string): Promise<string[]> {
  const raw = (await fetchRakutenAssignments({ from: date, to: date })) as {
    assignments?: Array<{ driver?: { id?: string } | null; site?: { name?: string } | null }>;
  };
  const ids = new Set<string>();
  for (const a of raw.assignments ?? []) {
    if (isBijogiSite(a.site?.name) && a.driver?.id) ids.add(a.driver.id);
  }
  return [...ids];
}

/**
 * CARIO から wave完了を取得する（当日のみ）。
 * @param date "YYYY-MM-DD"。CARIO API は当日固定のため date が JST今日 でなければ available:false。
 */
export async function getWaveCompletions(params: { date: string }): Promise<WaveCompletionsResult> {
  if (!isCarioApiConfigured()) {
    return { available: false, reason: "CARIO_NOT_CONFIGURED", completions: [] };
  }
  const today = jstDateStr(0);
  if (params.date !== today) {
    // このAPIは当日しか返さない（過去日は蓄積済みデータで表示）
    return { available: false, reason: "ONLY_TODAY_SUPPORTED", completions: [] };
  }

  const timeoutMs = parseInt(process.env.CARIO_TIMEOUT_MS ?? "15000", 10);

  let driverIds: string[];
  try {
    driverIds = await fetchBijogiDriverIds(params.date);
  } catch (err) {
    const reason = err instanceof CarioApiError ? err.type : "ASSIGNMENTS_FETCH_FAILED";
    return { available: false, reason, completions: [] };
  }

  const completions: NormalizedCompletion[] = [];
  // ドライバーごとに当日の wave 報告を取得（同時実行しすぎないよう小さめ並列）
  const CONCURRENCY = 5;
  for (let i = 0; i < driverIds.length; i += CONCURRENCY) {
    const batch = driverIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => fetchDriverWaves(id, timeoutMs).then((r) => [id, r] as const)));
    for (const [driverId, r] of results) {
      if (!r?.waves) continue;
      for (const w of r.waves) {
        const waveNo = parseWaveNo(String(w.wave_number ?? ""));
        if (!waveNo) continue;
        // 「ウェーブ終了ごとにカウント」= 帰庫(returned_at)したwaveのみ計上。出発しただけ/走行中は数えない。
        if (!w.returned_at) continue;
        completions.push({
          workDate: params.date,
          waveNo,
          vehicleType: w.zoubin_approved ? "増車" : "貼付",
          driverCarioId: driverId,
          driverName: null,
          completedAt: w.returned_at,
          count: null,
        });
      }
    }
  }

  return { available: true, completions };
}
