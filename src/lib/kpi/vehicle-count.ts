/**
 * 台数確認表（wave別 稼働台数の消化進捗）集計。read-only（SP保存を除く）。
 * riku指定マッピング: 貼付=通常稼働 / SP=手動入力 / 増車=フォロー。
 * 「wave完了に応じて加算」＝各waveを消化(全明細terminal)したクルー数を数える（ドライバー1人=1台）。
 *
 * 貼付（完了台数）= そのwaveを全て終えたドライバー数 / 予定台数 = そのwaveに割当のあるドライバー数。
 * 増車 = そのwaveの明細をフォロー(応援)しているドライバー数。
 * SP  = 判別データが無いため管理者が手入力した値（vehicle_count_manual）。
 */
import { prisma } from "@/lib/prisma";
import { WAVE_WINDOWS, parseWaveNo } from "@/lib/waves";

const TERMINAL = new Set(["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"]);

/** 手動入力カテゴリ（vehicle_count_manual.category）。SPは元から手入力、貼付/増車は手動上書き用。 */
export const MANUAL_SP = "SP";
export const MANUAL_HARITSUKE = "貼付";
export const MANUAL_ZOSHA = "増車";
export const MANUAL_CATEGORIES = [MANUAL_HARITSUKE, MANUAL_SP, MANUAL_ZOSHA] as const;
export type ManualCategory = (typeof MANUAL_CATEGORIES)[number];

export interface WaveCrewRow {
  wave: string;      // "W1"
  label: string;     // "1便"
  window: string;    // "10:00〜12:00"
  planned: number;   // 予定台数（通常稼働＝割当ありドライバー数）
  completed: number; // 貼付台数（自動集計。手動上書きがあればその値）
  sp: number;        // SP（手動入力）
  follows: number;   // 増車台数（自動=フォロー。手動上書きがあればその値）
  /** 手動上書きされているカテゴリ（UIで判別・"貼付"|"増車"。SPは常に手入力なので含めない） */
  overrides: { haritsuke: boolean; zosha: boolean };
}
export interface VehicleCountProgress {
  date: string;
  now: string;
  waves: WaveCrewRow[];
  totals: { planned: number; completed: number; sp: number; follows: number };
  /** CARIO の終了報告がこの日に取り込まれているか（貼付/増車に反映済み） */
  carioActive: boolean;
}

/** 対象日 00:00〜翌日 00:00 の範囲を返す */
function dayRange(date: string): { day: Date; next: Date } {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return { day, next };
}

/**
 * "YYYY-MM-DD" → その日の 00:00（ローカル）。
 * WaveCompletion / VehicleCountManual の @db.Date カラムの保存・照合に使う共通日付
 * （書き込みと読み取りで同一変換を使うことで round-trip を一致させる）。
 */
export function vehicleCountDayStart(date: string): Date {
  return dayRange(date).day;
}

export async function getVehicleCountProgress(date: string, now: Date = new Date()): Promise<VehicleCountProgress> {
  const { day, next } = dayRange(date);

  const [assignments, follows, manual, completions] = await Promise.all([
    prisma.assignment.findMany({
      where: { deliveryItem: { dispatchImage: { deliveryDate: { gte: day, lt: next } } } },
      select: { driverId: true, waveNo: true, deliveryItem: { select: { waveNo: true, deliveryStatus: true } } },
    }),
    prisma.deliveryFollow.findMany({
      where: { deliveryItem: { dispatchImage: { deliveryDate: { gte: day, lt: next } } } },
      select: { driverId: true, deliveryItem: { select: { waveNo: true } } },
    }),
    prisma.vehicleCountManual.findMany({
      where: { date: day },
      select: { waveNo: true, category: true, count: true },
    }),
    // CARIO からpullした終了報告（未同期なら空＝既存動作を維持）
    prisma.waveCompletion.findMany({
      where: { date: day },
      select: { waveNo: true, driverKey: true, vehicleType: true },
    }),
  ]);

  // wave番号(1-6) → driverId → {total, terminal}（予定台数＝割当ドライバー数）
  const byWave = new Map<number, Map<string, { total: number; terminal: number }>>();
  // 貼付・増車は driverKey の集合で重複排除（in-app driverId と CARIO driverKey を union）
  const haritsukeByWave = new Map<number, Set<string>>();
  const followByWave = new Map<number, Set<string>>();
  for (const w of WAVE_WINDOWS) { byWave.set(w.no, new Map()); haritsukeByWave.set(w.no, new Set()); followByWave.set(w.no, new Set()); }
  // 手動値（カテゴリ別）。貼付/増車は上書き、SPは入力値。
  const spByWave = new Map<number, number>();
  const haritsukeOverride = new Map<number, number>();
  const zoshaOverride = new Map<number, number>();
  for (const m of manual) {
    if (m.category === MANUAL_SP) spByWave.set(m.waveNo, m.count);
    else if (m.category === MANUAL_HARITSUKE) haritsukeOverride.set(m.waveNo, m.count);
    else if (m.category === MANUAL_ZOSHA) zoshaOverride.set(m.waveNo, m.count);
  }

  for (const a of assignments) {
    const no = parseWaveNo(a.deliveryItem.waveNo ?? a.waveNo);
    if (!no || !byWave.has(no)) continue;
    const m = byWave.get(no)!;
    const cur = m.get(a.driverId) ?? { total: 0, terminal: 0 };
    cur.total++;
    if (TERMINAL.has(a.deliveryItem.deliveryStatus)) cur.terminal++;
    m.set(a.driverId, cur);
  }
  // in-app: waveを消化(全明細terminal)したドライバーを貼付台数に
  for (const [no, m] of byWave) {
    for (const [driverId, agg] of m) {
      if (agg.total > 0 && agg.terminal === agg.total) haritsukeByWave.get(no)!.add(driverId);
    }
  }
  for (const f of follows) {
    const no = parseWaveNo(f.deliveryItem.waveNo);
    if (!no || !followByWave.has(no)) continue;
    followByWave.get(no)!.add(f.driverId);
  }
  // CARIO 終了報告をマージ（貼付/増車。SPは手入力を正とするため取り込まない）
  let carioActive = false;
  for (const c of completions) {
    if (!haritsukeByWave.has(c.waveNo)) continue;
    carioActive = true;
    if (c.vehicleType === "増車") followByWave.get(c.waveNo)!.add(c.driverKey);
    else if (c.vehicleType === "貼付") haritsukeByWave.get(c.waveNo)!.add(c.driverKey);
    // "SP" は手入力(vehicle_count_manual)を正とするので集計に加えない
  }

  const waves: WaveCrewRow[] = WAVE_WINDOWS.map((w) => {
    const planned = byWave.get(w.no)!.size;
    const autoHaritsuke = haritsukeByWave.get(w.no)!.size;
    const autoZosha = followByWave.get(w.no)!.size;
    const hOv = haritsukeOverride.get(w.no);
    const zOv = zoshaOverride.get(w.no);
    return {
      wave: w.key.toUpperCase(), label: w.label, window: `${w.start}〜${w.end}`,
      planned,
      completed: hOv ?? autoHaritsuke,
      sp: spByWave.get(w.no) ?? 0,
      follows: zOv ?? autoZosha,
      overrides: { haritsuke: hOv !== undefined, zosha: zOv !== undefined },
    };
  });

  const totals = waves.reduce(
    (acc, r) => ({ planned: acc.planned + r.planned, completed: acc.completed + r.completed, sp: acc.sp + r.sp, follows: acc.follows + r.follows }),
    { planned: 0, completed: 0, sp: 0, follows: 0 }
  );

  return { date, now: now.toISOString(), waves, totals, carioActive };
}

/**
 * 手動カウントを保存（date × wave × category でupsert）。count<0 は0に丸める。
 * 貼付/増車は自動集計への「上書き」、SPは入力値そのもの。
 */
export async function saveManualCount(
  date: string, waveNo: number, category: ManualCategory, count: number, updatedByName?: string
): Promise<void> {
  const { day } = dayRange(date);
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  await prisma.vehicleCountManual.upsert({
    where: { date_waveNo_category: { date: day, waveNo, category } },
    create: { date: day, waveNo, category, count: safe, updatedByName: updatedByName ?? null },
    update: { count: safe, updatedByName: updatedByName ?? null },
  });
}

/** 手動上書きを解除（自動集計へ戻す）。貼付/増車で使用。SPは0保存で実質クリア。 */
export async function clearManualCount(date: string, waveNo: number, category: ManualCategory): Promise<void> {
  const { day } = dayRange(date);
  await prisma.vehicleCountManual.deleteMany({ where: { date: day, waveNo, category } });
}

/** 後方互換: SP保存 */
export async function saveSpManual(date: string, waveNo: number, count: number, updatedByName?: string): Promise<void> {
  await saveManualCount(date, waveNo, MANUAL_SP, count, updatedByName);
}

// ─────────────────────────────────────────────
// 月次集計（Excel出力用）
// ─────────────────────────────────────────────

/** 1日分・1wave分の台数（貼付=完了台数 / SP=手動 / 増車=フォロー）。ov=手動上書き有無 */
export interface MonthlyCell {
  haritsuke: number; sp: number; zosha: number;
  ov: { haritsuke: boolean; zosha: boolean };
}
/** 月次集計: day("YYYY-MM-DD") → wave番号(1-6) → MonthlyCell */
export interface MonthlyVehicleCounts {
  month: string;               // "YYYY-MM"
  days: string[];              // その月の "YYYY-MM-DD" 昇順
  /** cells[day][waveNo] */
  cells: Record<string, Record<number, MonthlyCell>>;
}

/** "YYYY-MM" のその月の日付("YYYY-MM-DD"昇順)を返す */
function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const end = new Date(y!, m!, 1, 0, 0, 0, 0);
  const days: string[] = [];
  for (let d = new Date(y!, m! - 1, 1, 0, 0, 0, 0); d < end; d.setDate(d.getDate() + 1)) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return days;
}

/** wave文字列 "W3" → 3 */
function waveNoOf(wave: string): number {
  const m = wave.match(/([1-6])/);
  return m ? Number(m[1]) : 0;
}

/**
 * 月次の台数確認表を集計する（Excel出力用）。
 * 各日 getVehicleCountProgress をそのまま使うため、**画面の数値＝Excelの数値**が保証される
 * （日付・SPの突合ロジックを日次と一元化＝タイムゾーンずれ等の二重管理を防ぐ）。
 * 貼付=各waveを消化したドライバー数 / 増車=フォロー / SP=手動入力。
 */
export async function getMonthlyVehicleCounts(month: string): Promise<MonthlyVehicleCounts> {
  const days = monthDays(month);
  const cells: Record<string, Record<number, MonthlyCell>> = {};

  // 順次実行（接続プール枯渇を避ける・エクスポートは即時性より確実性を優先）
  for (const dk of days) {
    const progress = await getVehicleCountProgress(dk);
    cells[dk] = {};
    for (const w of progress.waves) {
      const no = waveNoOf(w.wave);
      if (!no) continue;
      cells[dk]![no] = { haritsuke: w.completed, sp: w.sp, zosha: w.follows, ov: w.overrides };
    }
  }

  return { month, days, cells };
}
