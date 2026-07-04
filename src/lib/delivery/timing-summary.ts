/**
 * 遅配（Wave締切超過）サマリ集計。read-only。
 * 単一真実源 `src/lib/waves.ts` の時間帯で判定し、Wave別に件数を返す。
 * β のダッシュボード/進捗の「遅配パネル」等がそのまま消費できる形。
 *
 * 完了時刻は DeliveryItem に専用列が無いため、
 *   deliveryStatus === "COMPLETED" の場合の updatedAt を「配達完了時刻の近似」として使う。
 */
import { prisma } from "@/lib/prisma";
import { WAVE_WINDOWS, parseWaveNo, waveWindowOf, isLate, deliveryTimingStatus } from "@/lib/waves";

export interface WaveTimingRow {
  wave: string;       // "w1"
  label: string;      // "1便"
  window: string;     // "10:00〜12:00"
  total: number;
  completed: number;
  lateCompleted: number;  // 完了済みだが締切超過（遅配実績）
  overdueActive: number;  // 未完了かつ現在締切超過（進行中の遅配）
  soon: number;           // 未完了・締切30分以内
  onTime: number;         // 未完了・余裕
}

export interface DeliveryTimingSummary {
  date: string;
  now: string;
  waves: WaveTimingRow[];
  unknownWave: number;    // Wave 判別不能な明細
  totals: { total: number; completed: number; lateCompleted: number; overdueActive: number };
}

export async function getDeliveryTimingSummary(date: string, now: Date = new Date()): Promise<DeliveryTimingSummary> {
  const deliveryDate = new Date(date);

  const images = await prisma.dispatchImage.findMany({
    where: { deliveryDate },
    select: { id: true },
  });
  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: { in: images.map((i) => i.id) } },
    select: { waveNo: true, deliveryStatus: true, updatedAt: true },
  });

  const rows: Record<number, WaveTimingRow> = {};
  for (const w of WAVE_WINDOWS) {
    rows[w.no] = {
      wave: w.key, label: w.label, window: `${w.start}〜${w.end}`,
      total: 0, completed: 0, lateCompleted: 0, overdueActive: 0, soon: 0, onTime: 0,
    };
  }
  let unknownWave = 0;

  for (const it of items) {
    const no = parseWaveNo(it.waveNo);
    if (!no || !rows[no]) { unknownWave++; continue; }
    const row = rows[no];
    row.total++;
    const isCompleted = it.deliveryStatus === "COMPLETED";
    if (isCompleted) {
      row.completed++;
      // 完了時刻(近似=updatedAt)が締切超過なら遅配実績
      if (waveWindowOf(no) && isLate(no, it.updatedAt)) row.lateCompleted++;
    } else {
      // 未完了は現在時刻で判定
      const status = deliveryTimingStatus(no, now);
      if (status === "LATE") row.overdueActive++;
      else if (status === "SOON") row.soon++;
      else row.onTime++;
    }
  }

  const waves = WAVE_WINDOWS.map((w) => rows[w.no]!);
  const totals = waves.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      completed: acc.completed + r.completed,
      lateCompleted: acc.lateCompleted + r.lateCompleted,
      overdueActive: acc.overdueActive + r.overdueActive,
    }),
    { total: 0, completed: 0, lateCompleted: 0, overdueActive: 0 }
  );

  return { date, now: now.toISOString(), waves, unknownWave, totals };
}
