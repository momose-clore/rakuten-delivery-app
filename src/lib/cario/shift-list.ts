/**
 * 保存済みシフトから /admin/shifts 用の表示ペイロードを生成する共有ヘルパー。
 * GET /api/shifts と GET /api/shifts/realtime が共用する。
 *
 * ⚠️ APIキー・Authorization・env 実値は返さない（安全な表示情報のみ）。
 */
import { prisma } from "@/lib/prisma";
import { isCarioApiConfigured, isProductionMock } from "./client";
import type {
  CarioConnectionDisplay,
  CarioConnectionMode,
  DriverWithShift,
  ShiftStatus,
} from "@/types/shift";

export interface ShiftListPayload {
  drivers: DriverWithShift[];
  summary: {
    total: number;
    confirmedCount: number;
    tentativeCount: number;
    companyBreakdown: Record<string, number>;
    areaBreakdown: Record<string, number>;
  };
  connection: CarioConnectionDisplay;
}

function fmtTime(d: Date | null): string | null {
  if (!d) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function buildConnectionInfo(
  targetDate: string,
  shifts: { source: string | null; sourceStatus: string | null; isStale: boolean; importedAt: Date | null }[]
): CarioConnectionDisplay {
  const apiConfigured = isCarioApiConfigured();

  const importedTimes = shifts
    .map((s) => s.importedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastImportedAt = importedTimes[0]?.toISOString() ?? null;

  const isStale = shifts.some((s) => s.isStale);
  const sourceStatus =
    shifts.find((s) => s.isStale)?.sourceStatus ?? shifts[0]?.sourceStatus ?? null;

  let mode: CarioConnectionMode;
  if (shifts.length === 0) {
    mode = apiConfigured ? "REAL_API" : "MOCK";
  } else if (isStale) {
    mode = "LAST_IMPORTED";
  } else if (shifts.some((s) => s.source === "CARIO_MOCK" || s.sourceStatus === "MOCK")) {
    mode = "MOCK";
  } else {
    mode = "REAL_API";
  }

  let staleReason: string | null = null;
  if (isStale) {
    if (sourceStatus === "API_FAILURE") {
      staleReason = "CARIO API の取得に失敗したため、前回取込データを表示しています。";
    } else if (sourceStatus === "USER_APPROVED") {
      staleReason = "管理者が前回取込データの継続使用を承認済みです。";
    } else {
      staleReason = "最新データを取得できていないため、前回取込データを表示しています。";
    }
  }

  return {
    mode,
    apiConfigured,
    isProductionMock: isProductionMock(),
    targetDate,
    lastImportedAt,
    isStale,
    sourceStatus,
    staleReason,
  };
}

/** 対象日の保存済みシフトから表示ペイロードを生成する。 */
export async function getShiftListPayload(date: string): Promise<ShiftListPayload> {
  const workDate = new Date(date);

  const shifts = await prisma.shift.findMany({
    where: { workDate },
    include: { driver: true },
    orderBy: [{ driver: { companyName: "asc" } }, { driver: { name: "asc" } }],
  });

  const drivers: DriverWithShift[] = shifts.map((s) => ({
    driverId: s.driver.id,
    carioDriverId: s.driver.carioDriverId,
    name: s.driver.name,
    companyName: s.driver.companyName,
    area: s.driver.area,
    vehicleId: s.driver.vehicleId,
    shiftId: s.id,
    workDate: s.workDate.toISOString().split("T")[0]!,
    startTime: fmtTime(s.startTime),
    endTime: fmtTime(s.endTime),
    status: s.status as ShiftStatus,
  }));

  const companyBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};
  let confirmedCount = 0;
  let tentativeCount = 0;

  for (const d of drivers) {
    if (d.status === "CONFIRMED") confirmedCount++;
    if (d.status === "TENTATIVE") tentativeCount++;
    companyBreakdown[d.companyName ?? "不明"] = (companyBreakdown[d.companyName ?? "不明"] ?? 0) + 1;
    areaBreakdown[d.area ?? "不明"] = (areaBreakdown[d.area ?? "不明"] ?? 0) + 1;
  }

  return {
    drivers,
    summary: {
      total: drivers.length,
      confirmedCount,
      tentativeCount,
      companyBreakdown,
      areaBreakdown,
    },
    connection: buildConnectionInfo(date, shifts),
  };
}
