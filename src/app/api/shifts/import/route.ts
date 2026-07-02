import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { CarioApiError, getCarioConnectionMode, isProductionMock } from "@/lib/cario/client";
import { fetchAssignmentsForDate } from "@/lib/cario/getAssignments";
import type { ImportSummary } from "@/lib/cario/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date } = await req.json() as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const targetDate = new Date(date);
  const connectionMode = getCarioConnectionMode();
  const productionMock = isProductionMock();

  // CARIO assignments API からデータ取得
  let carioResult;
  try {
    carioResult = await fetchAssignmentsForDate(targetDate);
  } catch (err) {
    if (err instanceof CarioApiError) {
      // 既存 stale シフトを isStale=true にマーク
      await prisma.shift.updateMany({
        where: { workDate: targetDate },
        data: { isStale: true, sourceStatus: "API_FAILURE" },
      });

      const httpStatus = err.type === "AUTH" ? 502
        : err.type === "TIMEOUT"  ? 504
        : 502;

      // 安全なエラーメッセージのみ返す（APIキー・URL・個人情報は含めない）
      return NextResponse.json({
        error: err.message,
        isStale: true,
        connectionMode,
      }, { status: httpStatus });
    }
    return NextResponse.json({ error: "CARIOデータの取得に失敗しました" }, { status: 502 });
  }

  const { drivers: carioDrivers, shifts: carioShifts, warnings: mapperWarnings, usedMock } = carioResult;

  let driverUpserted = 0;
  let shiftUpserted = 0;
  const companyBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};
  const driverIdMap: Record<string, string> = {};

  // drivers upsert
  for (const cd of carioDrivers) {
    const driver = await prisma.driver.upsert({
      where: { carioDriverId: cd.carioDriverId },
      update: { name: cd.name, phone: cd.phone, companyName: cd.companyName, area: cd.area, vehicleId: cd.vehicleId },
      create: { carioDriverId: cd.carioDriverId, name: cd.name, phone: cd.phone, companyName: cd.companyName, area: cd.area, vehicleId: cd.vehicleId },
    });
    driverIdMap[cd.carioDriverId] = driver.id;
    driverUpserted++;
  }

  // shifts upsert
  let confirmedCount = 0;
  let tentativeCount = 0;
  let absentCount = 0;

  const sourceStatus = usedMock ? "MOCK" : "OK";
  const sourceLabel  = usedMock ? "CARIO_MOCK" : "CARIO_API";

  for (const cs of carioShifts) {
    const driverId = driverIdMap[cs.carioDriverId];
    if (!driverId) continue;

    const workDate = new Date(cs.workDate || date);
    const parseTime = (t: string | null) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      const d = new Date(0);
      d.setUTCHours(h!, m!, 0, 0);
      return d;
    };

    await prisma.shift.upsert({
      where: { driverId_workDate: { driverId, workDate } },
      update: {
        startTime:    parseTime(cs.startTime),
        endTime:      parseTime(cs.endTime),
        status:       cs.status,
        source:       sourceLabel,
        isStale:      false,
        sourceStatus,
        importedAt:   new Date(),
      },
      create: {
        driverId,
        workDate,
        startTime:    parseTime(cs.startTime),
        endTime:      parseTime(cs.endTime),
        status:       cs.status,
        source:       sourceLabel,
        isStale:      false,
        sourceStatus,
        importedAt:   new Date(),
      },
    });
    shiftUpserted++;

    if (cs.status === "CONFIRMED")  confirmedCount++;
    else if (cs.status === "TENTATIVE") tentativeCount++;
    else absentCount++;

    const cd = carioDrivers.find((d) => d.carioDriverId === cs.carioDriverId);
    if (cd) {
      const company = cd.companyName ?? "不明";
      const area    = cd.area ?? "不明";
      companyBreakdown[company] = (companyBreakdown[company] ?? 0) + 1;
      areaBreakdown[area]       = (areaBreakdown[area] ?? 0) + 1;
    }
  }

  const summary: ImportSummary = {
    date,
    driverUpserted,
    shiftUpserted,
    confirmedCount,
    tentativeCount,
    absentCount,
    companyBreakdown,
    areaBreakdown,
    connectionMode,
    isStale: false,
    mapperWarnings: mapperWarnings.length > 0 ? mapperWarnings : undefined,
  };

  // 操作ログ（件数のみ・個人情報なし・APIキーなし）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPORT_CARIO_SHIFTS",
      targetType: "shifts",
      targetId: date,
      afterData: {
        driverUpserted,
        shiftUpserted,
        confirmedCount,
        tentativeCount,
        absentCount,
        connectionMode,
        usedMock,
      },
    },
  });

  return NextResponse.json({
    success: true,
    summary,
    connectionMode,
    usedMock,
    isProductionMock: productionMock,
    mapperWarnings: mapperWarnings.length > 0 ? mapperWarnings : undefined,
  });
}
