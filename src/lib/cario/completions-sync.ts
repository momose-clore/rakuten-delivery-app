/**
 * CARIO の「稼働者の終了報告（wave完了）」を pull → wave_completions を当日ぶん全刷新（冪等）。
 * 台数確認表（貼付/増車）へ driver×wave×date で反映する。SP は手入力を正とするため取り込まない。
 *
 * 冪等性: 対象日の source=CARIO 行を deleteMany → 最新を createMany。
 *   ※ pull が available:false（当日以外／未到達）のときは **DBを一切触らない**（蓄積済みを保持）。
 * driver突合: CARIO driver.id → 当アプリ Driver.carioDriverId が一致すれば driverId を確定し
 *             driverKey を当アプリ driverId に揃える（in-app 完了との重複を排除）。
 */
import { prisma } from "@/lib/prisma";
import { getWaveCompletions, type NormalizedCompletion } from "./getCompletions";
import { parseLineExport } from "./parseLineExport";
import { vehicleCountDayStart } from "@/lib/kpi/vehicle-count";

export interface CompletionsSyncResult {
  available: boolean;
  reason?: string;
  date: string;
  inserted: number;
}

interface CompletionRow {
  date: Date;
  waveNo: number;
  driverKey: string;
  driverId: string | null;
  driverName: string | null;
  vehicleType: string;
  completedAt: Date | null;
  source: string;
}

/** CARIO driver.id → 当アプリ Driver.id の対応表を作る */
async function resolveDriverMap(carioIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(carioIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const drivers = await prisma.driver.findMany({
    where: { carioDriverId: { in: ids } },
    select: { id: true, carioDriverId: true },
  });
  const map = new Map<string, string>();
  for (const d of drivers) if (d.carioDriverId) map.set(d.carioDriverId, d.id);
  return map;
}

/** completedAt（ISO or "HH:MM"）を Date へ。"HH:MM" は対象日に合成。失敗は null。 */
function parseCompletedAt(raw: string | null, dateStr: string): Date | null {
  if (!raw) return null;
  const hm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const d = new Date(`${dateStr}T${hm[1]!.padStart(2, "0")}:${hm[2]}:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** 正規化済み完了 → 保存行（driver粒度は (date,wave) 内で driverKey 重複排除。count 粒度は合成展開）。 */
function buildRows(
  date: string,
  completions: NormalizedCompletion[],
  driverMap: Map<string, string>,
  source: string
): CompletionRow[] {
  const rows: CompletionRow[] = [];
  const dateObj = vehicleCountDayStart(date);
  const seen = new Map<string, Set<string>>(); // (wave|vehicleType) → driverKey
  const seenKey = (w: number, vt: string) => `${w}|${vt}`;

  for (const c of completions) {
    const completedAt = parseCompletedAt(c.completedAt, date);

    if (c.count != null) {
      const n = Math.max(0, Math.floor(c.count));
      for (let i = 0; i < n; i++) {
        rows.push({
          date: dateObj, waveNo: c.waveNo, driverKey: `agg:${c.vehicleType}:${i}`,
          driverId: null, driverName: null, vehicleType: c.vehicleType, completedAt, source,
        });
      }
      continue;
    }

    const resolved = c.driverCarioId ? driverMap.get(c.driverCarioId) : undefined;
    const driverKey = resolved
      ? resolved
      : c.driverCarioId
        ? `cario:${c.driverCarioId}`
        : c.driverName
          ? `name:${c.driverName}`
          : `anon:${rows.length}`;

    // 同一driver×wave×vehicleTypeは1台（同一waveで貼付/増車が分かれるなら別カウント）
    const sk = seenKey(c.waveNo, c.vehicleType);
    if (!seen.has(sk)) seen.set(sk, new Set());
    if (seen.get(sk)!.has(driverKey)) continue;
    seen.get(sk)!.add(driverKey);

    rows.push({
      date: dateObj, waveNo: c.waveNo, driverKey,
      driverId: resolved ?? null, driverName: c.driverName, vehicleType: c.vehicleType,
      completedAt, source,
    });
  }
  return rows;
}

/**
 * CARIO 完了を同期する（1日分）。
 * @param date "YYYY-MM-DD"（CARIO API仕様上、実データが取れるのは JST今日 のみ）
 */
export async function syncCarioCompletions(date: string): Promise<CompletionsSyncResult> {
  const pulled = await getWaveCompletions({ date });
  if (!pulled.available) {
    // 取得不可時はDBを触らない（過去日の蓄積を保持）
    return { available: false, reason: pulled.reason, date, inserted: 0 };
  }

  const driverMap = await resolveDriverMap(
    pulled.completions.map((c) => c.driverCarioId).filter((x): x is string => !!x)
  );
  const rows = buildRows(date, pulled.completions, driverMap, "CARIO");
  const dateObj = vehicleCountDayStart(date);

  // 当日ぶんだけ全刷新（冪等）
  await prisma.$transaction([
    prisma.waveCompletion.deleteMany({ where: { source: "CARIO", date: dateObj } }),
    ...(rows.length > 0 ? [prisma.waveCompletion.createMany({ data: rows })] : []),
  ]);

  return { available: true, date, inserted: rows.length };
}

export interface LineImportResult {
  dates: string[];   // 取り込んだ日付
  events: number;    // 帰庫イベント総数
  inserted: number;  // 挿入行数（重複排除後）
}

/**
 * LINEトーク履歴エクスポート(.txt本文)から帰庫を取り込む（過去日バックフィル）。
 * source="LINE" で保存し、含まれる日付ごとに全刷新（冪等）。CARIO API(当日/source=CARIO)とは分離。
 * @param opts.from "YYYY-MM-DD" 指定時、その日より前の日付は取り込まない（例: 6月除外は from="2026-07-01"）
 */
export async function importLineCompletions(
  text: string,
  opts?: { from?: string }
): Promise<LineImportResult> {
  const parsed = parseLineExport(text);
  const from = opts?.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) ? opts.from : null;
  const kept = from ? parsed.completions.filter((c) => c.workDate >= from) : parsed.completions;
  if (kept.length === 0) {
    return { dates: [], events: 0, inserted: 0 };
  }

  // 日付ごとにまとめる（driverKey は氏名ベース＝"name:氏名"。同一氏名×wave×日は1台に排除）
  const byDate = new Map<string, NormalizedCompletion[]>();
  for (const c of kept) {
    if (!byDate.has(c.workDate)) byDate.set(c.workDate, []);
    byDate.get(c.workDate)!.push(c);
  }

  let inserted = 0;
  for (const [date, comps] of byDate) {
    const rows = buildRows(date, comps, new Map(), "LINE");
    const dateObj = vehicleCountDayStart(date);
    await prisma.$transaction([
      prisma.waveCompletion.deleteMany({ where: { source: "LINE", date: dateObj } }),
      ...(rows.length > 0 ? [prisma.waveCompletion.createMany({ data: rows })] : []),
    ]);
    inserted += rows.length;
  }

  return { dates: [...byDate.keys()].sort(), events: kept.length, inserted };
}
