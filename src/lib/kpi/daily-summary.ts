/**
 * 日次KPI集計（管理ダッシュボード用・read-only）。
 * 遅配判定は単一真実源 `src/lib/waves.ts` を使用。
 *
 * ※ 配達完了の専用時刻列が無いため、`deliveryStatus==="COMPLETED"` の `updatedAt` を完了時刻の近似とする
 *    （遅配「実績」は近似値。将来 completedAt 追加で精緻化可 → 改善バックログ item2）。
 */
import { prisma } from "@/lib/prisma";
import { WAVE_WINDOWS, parseWaveNo, isLate, deliveryTimingStatus } from "@/lib/waves";

export interface KpiWaveRow {
  wave: string; label: string; window: string;
  total: number; completed: number; late: number; // late = 遅配実績＋進行中遅配
}
export interface KpiDriverRow {
  driverId: string; name: string;
  assigned: number; completed: number; overdue: number; // overdue=未完で締切超過
}
export interface DailyKpi {
  date: string;
  now: string;
  driversOnShift: number;
  delivery: {
    total: number;
    completed: number;
    inProgress: number;
    unassigned: number;
    completionRate: number;   // 0-1
    onTimeRate: number | null; // 完了のうち締切内 / null=完了0
    lateCompleted: number;    // 完了だが締切超過（遅配実績）
    overdueActive: number;    // 未完で現在締切超過
  };
  byWave: KpiWaveRow[];
  byDriver: KpiDriverRow[];
}

export async function getDailyKpi(date: string, now: Date = new Date()): Promise<DailyKpi> {
  const deliveryDate = new Date(date);

  const [driversOnShift, images] = await Promise.all([
    prisma.shift.count({ where: { workDate: deliveryDate, status: { in: ["CONFIRMED", "TENTATIVE"] } } }),
    prisma.dispatchImage.findMany({ where: { deliveryDate }, select: { id: true } }),
  ]);

  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: { in: images.map((i) => i.id) } },
    select: {
      waveNo: true,
      deliveryStatus: true,
      updatedAt: true,
      assignments: { select: { driver: { select: { id: true, name: true } } } },
    },
  });

  // Wave行・ドライバー行の器
  const waveRows = new Map<number, KpiWaveRow>();
  for (const w of WAVE_WINDOWS) waveRows.set(w.no, { wave: w.key, label: w.label, window: `${w.start}〜${w.end}`, total: 0, completed: 0, late: 0 });
  const driverRows = new Map<string, KpiDriverRow>();

  let total = 0, completed = 0, inProgress = 0, unassigned = 0, lateCompleted = 0, overdueActive = 0;

  for (const it of items) {
    total++;
    const isCompleted = it.deliveryStatus === "COMPLETED";
    const driver = it.assignments[0]?.driver ?? null;
    if (!driver) unassigned++;
    if (it.deliveryStatus === "IN_DELIVERY") inProgress++;

    let late = false;
    if (isCompleted) {
      completed++;
      if (isLate(it.waveNo, it.updatedAt)) { lateCompleted++; late = true; }
    } else if (deliveryTimingStatus(it.waveNo, now) === "LATE") {
      overdueActive++; late = true;
    }

    const no = parseWaveNo(it.waveNo);
    if (no && waveRows.has(no)) {
      const r = waveRows.get(no)!;
      r.total++; if (isCompleted) r.completed++; if (late) r.late++;
    }
    if (driver) {
      const dr = driverRows.get(driver.id) ?? { driverId: driver.id, name: driver.name, assigned: 0, completed: 0, overdue: 0 };
      dr.assigned++;
      if (isCompleted) dr.completed++;
      if (!isCompleted && deliveryTimingStatus(it.waveNo, now) === "LATE") dr.overdue++;
      driverRows.set(driver.id, dr);
    }
  }

  return {
    date,
    now: now.toISOString(),
    driversOnShift,
    delivery: {
      total, completed, inProgress, unassigned,
      completionRate: total ? Math.round((completed / total) * 1000) / 1000 : 0,
      onTimeRate: completed ? Math.round(((completed - lateCompleted) / completed) * 1000) / 1000 : null,
      lateCompleted, overdueActive,
    },
    byWave: WAVE_WINDOWS.map((w) => waveRows.get(w.no)!),
    byDriver: [...driverRows.values()].sort((a, b) => b.overdue - a.overdue || b.assigned - a.assigned),
  };
}
