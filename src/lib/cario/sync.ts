/**
 * CARIO assignments → 自アプリDB 同期コア（共有ロジック）
 *
 * 手動取込 / リアルタイムポーリング / Cron の3経路が共通で使う。
 * 受信専用（CARIOへはGETのみ）。書き込み対象は自アプリDB(drivers/shifts)のみ。
 *
 * データ保護方針:
 *   - drivers.phone / companyName は「非nullの時のみ」更新（既存値をnullで壊さない）
 *   - name / area / vehicleId は CARIO を正として更新
 *   - shifts は driverId×workDate で upsert（重複登録なし）
 */
import { prisma } from "@/lib/prisma";
import { fetchAssignmentsForRange } from "./getAssignments";

export interface CarioSyncResult {
  from: string;
  to: string;
  driverCreated: number;
  driverUpdated: number;
  shiftUpserted: number;
  confirmedCount: number;
  tentativeCount: number;
  absentCount: number;
  companyBreakdown: Record<string, number>;
  areaBreakdown: Record<string, number>;
  usedMock: boolean;
  warnings: string[];
}

/** JST(+9h)基準の日付文字列 "YYYY-MM-DD"（offsetDays で前後にずらす） */
export function jstDateStr(offsetDays = 0): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() + offsetDays);
  return jst.toISOString().split("T")[0]!;
}

/**
 * 指定期間の assignments を CARIO から取得し DB に同期する。
 * API失敗時は CarioApiError を throw する（stale処理は呼び出し側の責務）。
 */
export async function syncCarioAssignments(
  from: string,
  to?: string
): Promise<CarioSyncResult> {
  const toDate = to ?? from;
  const { drivers, shifts, warnings, usedMock } =
    await fetchAssignmentsForRange(from, toDate);

  // 既存ドライバーを取得（phone/companyName の null 上書き防止のため）
  const carioIds = drivers.map((d) => d.carioDriverId);
  const existing = await prisma.driver.findMany({
    where: { carioDriverId: { in: carioIds } },
    select: { id: true, carioDriverId: true, name: true, area: true, vehicleId: true },
  });
  const existingByCario = new Map(existing.map((e) => [e.carioDriverId!, e]));

  const driverIdMap: Record<string, string> = {};
  let driverCreated = 0;
  let driverUpdated = 0;

  for (const d of drivers) {
    const ex = existingByCario.get(d.carioDriverId);
    const driver = await prisma.driver.upsert({
      where: { carioDriverId: d.carioDriverId },
      update: {
        name: d.name || ex?.name || "",
        // phone / companyName は非nullの時だけ上書き（既存値保護）
        ...(d.phone ? { phone: d.phone } : {}),
        ...(d.companyName ? { companyName: d.companyName } : {}),
        area: d.area ?? ex?.area ?? null,
        vehicleId: d.vehicleId ?? ex?.vehicleId ?? null,
      },
      create: {
        carioDriverId: d.carioDriverId,
        name: d.name,
        phone: d.phone,
        companyName: d.companyName,
        area: d.area,
        vehicleId: d.vehicleId,
      },
    });
    driverIdMap[d.carioDriverId] = driver.id;
    if (ex) driverUpdated++;
    else driverCreated++;
  }

  const sourceLabel = usedMock ? "CARIO_MOCK" : "CARIO_API";
  const sourceStatus = usedMock ? "MOCK" : "OK";
  const companyBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};
  let shiftUpserted = 0;
  let confirmedCount = 0;
  let tentativeCount = 0;
  let absentCount = 0;

  for (const s of shifts) {
    const driverId = driverIdMap[s.carioDriverId];
    if (!driverId) continue;
    const workDate = new Date(s.workDate);

    await prisma.shift.upsert({
      where: { driverId_workDate: { driverId, workDate } },
      update: {
        status: s.status,
        source: sourceLabel,
        isStale: false,
        sourceStatus,
        importedAt: new Date(),
      },
      create: {
        driverId,
        workDate,
        startTime: null,
        endTime: null,
        status: s.status,
        source: sourceLabel,
        isStale: false,
        sourceStatus,
        importedAt: new Date(),
      },
    });
    shiftUpserted++;

    if (s.status === "CONFIRMED") confirmedCount++;
    else if (s.status === "TENTATIVE") tentativeCount++;
    else absentCount++;

    const cd = drivers.find((d) => d.carioDriverId === s.carioDriverId);
    const company = cd?.companyName ?? "不明";
    const area = cd?.area ?? "不明";
    companyBreakdown[company] = (companyBreakdown[company] ?? 0) + 1;
    areaBreakdown[area] = (areaBreakdown[area] ?? 0) + 1;
  }

  return {
    from,
    to: toDate,
    driverCreated,
    driverUpdated,
    shiftUpserted,
    confirmedCount,
    tentativeCount,
    absentCount,
    companyBreakdown,
    areaBreakdown,
    usedMock,
    warnings,
  };
}

/** 指定期間のシフトを stale（API_FAILURE）にマークする（CARIO取得失敗時） */
export async function markRangeStale(from: string, to?: string): Promise<void> {
  const toDate = to ?? from;
  await prisma.shift.updateMany({
    where: { workDate: { gte: new Date(from), lte: new Date(toDate) } },
    data: { isStale: true, sourceStatus: "API_FAILURE" },
  });
}
