/**
 * CARIO の Supabase から「wave完了（便ごとの終了報告）」を直接READする（読み取り専用）。
 *
 * 背景: クルーは楽天アプリを使わず、CARIOの crew dashboard(`/api/wave/finish`)で便ごとに完了報告する。
 *   その実データは CARIO Supabase の `wave_completions` テーブル（work_date=JST・finished_at=完了時刻付き）。
 *   ※ 旧 `/api/rakuten/wave`＋`rakuten_wave_records` は 6/26 で停止。現行はこのテーブル。
 * 財務サイトと同様、共有Supabaseを READ-ONLY で参照する（CARIOは一切変更しない）。
 *
 * env: CARIO_SUPABASE_URL / CARIO_SUPABASE_ANON_KEY（anonキー＝公開キー）。
 */

// CARIO Supabase の接続情報。KEY は Supabase の "publishable"（公開）キーで、
// CARIO のブラウザにも露出しており RLS で保護されるため、env未設定時のフォールバックとして持つ。
const DEFAULT_URL = "https://ticdrjgcfdgrfurmeoyd.supabase.co";
const DEFAULT_KEY = "sb_publishable_LCI1qpTdzPf_v0D7wCf0MQ_IefQWOF8";

function creds(): { url: string; key: string } | null {
  const url = process.env.CARIO_SUPABASE_URL ?? DEFAULT_URL;
  const key = process.env.CARIO_SUPABASE_ANON_KEY ?? DEFAULT_KEY;
  if (!key) return null;
  return { url, key };
}

/** CARIO 側の wave 完了1件（便ごと） */
export interface CarioWaveRow {
  workDate: string;      // "YYYY-MM-DD"（JST）
  driverId: string;      // CARIO の driver_id
  waveNo: number;        // 便番号
  finishedAt: string | null; // 完了時刻（ISO・UTC）
}

/** CARIO wave_completions を期間で取得（read-only） */
export async function fetchCarioWaveCompletions(
  from: string,
  to: string
): Promise<{ available: boolean; reason?: string; rows: CarioWaveRow[] }> {
  const c = creds();
  if (!c) return { available: false, reason: "CARIO_SUPABASE_NOT_CONFIGURED", rows: [] };

  const url =
    `${c.url}/rest/v1/wave_completions` +
    `?select=work_date,driver_id,wave_number,finished_at` +
    `&work_date=gte.${from}&work_date=lte.${to}` +
    `&order=work_date.desc&limit=5000`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return { available: false, reason: "NETWORK", rows: [] };
  }
  if (!res.ok) return { available: false, reason: `HTTP_${res.status}`, rows: [] };

  const data = (await res.json()) as Array<{ work_date: string; driver_id: string; wave_number: number; finished_at: string | null }>;
  if (!Array.isArray(data)) return { available: false, reason: "BAD_RESPONSE", rows: [] };

  const rows: CarioWaveRow[] = data
    .filter((r) => r.work_date && r.driver_id && r.wave_number >= 1 && r.wave_number <= 6)
    .map((r) => ({ workDate: r.work_date.slice(0, 10), driverId: r.driver_id, waveNo: r.wave_number, finishedAt: r.finished_at }));

  return { available: true, rows };
}

/** CARIO drivers（id→name）を取得（表示名の補完用・read-only） */
export async function fetchCarioDriverNames(): Promise<Map<string, string>> {
  const c = creds();
  const map = new Map<string, string>();
  if (!c) return map;
  try {
    const res = await fetch(`${c.url}/rest/v1/drivers?select=id,name&limit=2000`, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return map;
    const data = (await res.json()) as Array<{ id: string; name: string }>;
    for (const d of data) if (d.id && d.name) map.set(d.id, d.name);
  } catch {
    /* best-effort */
  }
  return map;
}
