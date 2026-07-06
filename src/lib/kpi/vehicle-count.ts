/**
 * 台数管理表（wave別 稼働台数の消化進捗）集計。read-only。
 * riku指定マッピング: 貼付=通常稼働 / SP=無視 / 増車=フォロー。
 * 「wave完了に応じて加算」＝各waveを消化(全明細terminal)したクルー数を数える。
 *
 * 完了台数 = そのwaveを全て終えたドライバー数 / 予定台数 = そのwaveに割当のあるドライバー数。
 * 増車 = そのwaveの明細をフォロー(応援)しているドライバー数。
 */
import { prisma } from "@/lib/prisma";
import { WAVE_WINDOWS, parseWaveNo } from "@/lib/waves";

const TERMINAL = new Set(["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"]);

export interface WaveCrewRow {
  wave: string;      // "W1"
  label: string;     // "1便"
  window: string;    // "10:00〜12:00"
  planned: number;   // 予定台数（通常稼働＝割当ありドライバー数）
  completed: number; // 完了台数（waveを消化したドライバー数）
  follows: number;   // 増車（フォロー）ドライバー数
}
export interface VehicleCountProgress {
  date: string;
  now: string;
  waves: WaveCrewRow[];
  totals: { planned: number; completed: number; follows: number };
}

export async function getVehicleCountProgress(date: string, now: Date = new Date()): Promise<VehicleCountProgress> {
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const next = new Date(day); next.setDate(next.getDate() + 1);

  const [assignments, follows] = await Promise.all([
    prisma.assignment.findMany({
      where: { deliveryItem: { dispatchImage: { deliveryDate: { gte: day, lt: next } } } },
      select: { driverId: true, waveNo: true, deliveryItem: { select: { waveNo: true, deliveryStatus: true } } },
    }),
    prisma.deliveryFollow.findMany({
      where: { deliveryItem: { dispatchImage: { deliveryDate: { gte: day, lt: next } } } },
      select: { driverId: true, deliveryItem: { select: { waveNo: true } } },
    }),
  ]);

  // wave番号(1-6) → driverId → {total, terminal}
  const byWave = new Map<number, Map<string, { total: number; terminal: number }>>();
  const followByWave = new Map<number, Set<string>>();
  for (const w of WAVE_WINDOWS) { byWave.set(w.no, new Map()); followByWave.set(w.no, new Set()); }

  for (const a of assignments) {
    const no = parseWaveNo(a.deliveryItem.waveNo ?? a.waveNo);
    if (!no || !byWave.has(no)) continue;
    const m = byWave.get(no)!;
    const cur = m.get(a.driverId) ?? { total: 0, terminal: 0 };
    cur.total++;
    if (TERMINAL.has(a.deliveryItem.deliveryStatus)) cur.terminal++;
    m.set(a.driverId, cur);
  }
  for (const f of follows) {
    const no = parseWaveNo(f.deliveryItem.waveNo);
    if (!no || !followByWave.has(no)) continue;
    followByWave.get(no)!.add(f.driverId);
  }

  const waves: WaveCrewRow[] = WAVE_WINDOWS.map((w) => {
    const m = byWave.get(w.no)!;
    let planned = 0, completed = 0;
    for (const agg of m.values()) {
      planned++;
      if (agg.total > 0 && agg.terminal === agg.total) completed++;
    }
    return { wave: w.key.toUpperCase(), label: w.label, window: `${w.start}〜${w.end}`, planned, completed, follows: followByWave.get(w.no)!.size };
  });

  const totals = waves.reduce(
    (acc, r) => ({ planned: acc.planned + r.planned, completed: acc.completed + r.completed, follows: acc.follows + r.follows }),
    { planned: 0, completed: 0, follows: 0 }
  );

  return { date, now: now.toISOString(), waves, totals };
}
