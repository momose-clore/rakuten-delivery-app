import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { fetchCarioDrivers, fetchCarioShifts } from "@/lib/cario";
import { CarioApiError } from "@/lib/cario/client";
import type { ImportSummary } from "@/lib/cario/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const targetDate = new Date(date);

  // CARIO からデータ取得（エラー種別を管理画面に返す）
  let carioDrivers, carioShifts;
  try {
    [carioDrivers, carioShifts] = await Promise.all([
      fetchCarioDrivers(targetDate),
      fetchCarioShifts(targetDate),
    ]);
  } catch (err) {
    if (err instanceof CarioApiError) {
      const status = err.type === "AUTH" ? 502 : err.type === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: "CARIOデータの取得に失敗しました" }, { status: 502 });
  }

  let driverUpserted = 0;
  let shiftUpserted = 0;
  const companyBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};

  // drivers upsert（carioDriverId でキー）
  const driverIdMap: Record<string, string> = {};

  for (const cd of carioDrivers) {
    const driver = await prisma.driver.upsert({
      where: { carioDriverId: cd.carioDriverId },
      update: {
        name: cd.name,
        phone: cd.phone,
        companyName: cd.companyName,
        area: cd.area,
        vehicleId: cd.vehicleId,
      },
      create: {
        carioDriverId: cd.carioDriverId,
        name: cd.name,
        phone: cd.phone,
        companyName: cd.companyName,
        area: cd.area,
        vehicleId: cd.vehicleId,
      },
    });
    driverIdMap[cd.carioDriverId] = driver.id;
    driverUpserted++;
  }

  // shifts upsert（driverId + workDate でキー）
  let confirmedCount = 0;
  let tentativeCount = 0;
  let absentCount = 0;

  for (const cs of carioShifts) {
    const driverId = driverIdMap[cs.carioDriverId];
    if (!driverId) continue;

    const workDate = new Date(cs.workDate);
    const parseTime = (t: string | null) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      const d = new Date(0);
      d.setUTCHours(h, m, 0, 0);
      return d;
    };

    await prisma.shift.upsert({
      where: { driverId_workDate: { driverId, workDate } },
      update: {
        startTime: parseTime(cs.startTime),
        endTime: parseTime(cs.endTime),
        status: cs.status,
        source: "CARIO_MOCK",
      },
      create: {
        driverId,
        workDate,
        startTime: parseTime(cs.startTime),
        endTime: parseTime(cs.endTime),
        status: cs.status,
        source: "CARIO_MOCK",
      },
    });
    shiftUpserted++;

    if (cs.status === "CONFIRMED") confirmedCount++;
    else if (cs.status === "TENTATIVE") tentativeCount++;
    else absentCount++;

    // 集計（ドライバー情報から）
    const cd = carioDrivers.find((d) => d.carioDriverId === cs.carioDriverId);
    if (cd) {
      const company = cd.companyName ?? "不明";
      const area = cd.area ?? "不明";
      companyBreakdown[company] = (companyBreakdown[company] ?? 0) + 1;
      areaBreakdown[area] = (areaBreakdown[area] ?? 0) + 1;
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
  };

  // 操作ログ（件数のみ、個人情報なし）
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
      },
    },
  });

  return NextResponse.json({ success: true, summary });
}
