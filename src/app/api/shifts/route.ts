import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { isCarioApiConfigured, isProductionMock } from "@/lib/cario/client";
import type { CarioConnectionDisplay, CarioConnectionMode } from "@/types/shift";

/**
 * 保存済みシフトから接続状態を判定する（安全な表示情報のみ生成）。
 * ⚠️ APIキー・Authorization・env 実値は返さない。
 */
function buildConnectionInfo(
  targetDate: string,
  shifts: { source: string | null; sourceStatus: string | null; isStale: boolean; importedAt: Date | null }[]
): CarioConnectionDisplay {
  const apiConfigured = isCarioApiConfigured();

  // 最終取込日時（最新の importedAt）
  const importedTimes = shifts
    .map((s) => s.importedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastImportedAt = importedTimes[0]?.toISOString() ?? null;

  const isStale = shifts.some((s) => s.isStale);
  // updateMany で日付単位に揃うため、代表値として stale 行を優先採用
  const sourceStatus =
    shifts.find((s) => s.isStale)?.sourceStatus ??
    shifts[0]?.sourceStatus ??
    null;

  let mode: CarioConnectionMode;
  if (shifts.length === 0) {
    // データ未取込：env 設定状況のみで案内
    mode = apiConfigured ? "REAL_API" : "MOCK";
  } else if (isStale) {
    // API 失敗などで前回取込データを表示中
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const workDate = new Date(date);

  const shifts = await prisma.shift.findMany({
    where: { workDate },
    include: { driver: true },
    orderBy: [{ driver: { companyName: "asc" } }, { driver: { name: "asc" } }],
  });

  const drivers = shifts.map((s) => ({
    driverId: s.driver.id,
    carioDriverId: s.driver.carioDriverId,
    name: s.driver.name,
    companyName: s.driver.companyName,
    area: s.driver.area,
    vehicleId: s.driver.vehicleId,
    shiftId: s.id,
    workDate: s.workDate.toISOString().split("T")[0],
    startTime: s.startTime ? `${String(s.startTime.getUTCHours()).padStart(2, "0")}:${String(s.startTime.getUTCMinutes()).padStart(2, "0")}` : null,
    endTime: s.endTime ? `${String(s.endTime.getUTCHours()).padStart(2, "0")}:${String(s.endTime.getUTCMinutes()).padStart(2, "0")}` : null,
    status: s.status,
  }));

  // 集計
  const companyBreakdown: Record<string, number> = {};
  const areaBreakdown: Record<string, number> = {};
  let confirmedCount = 0;
  let tentativeCount = 0;

  for (const d of drivers) {
    if (d.status === "CONFIRMED") confirmedCount++;
    if (d.status === "TENTATIVE") tentativeCount++;
    const company = d.companyName ?? "不明";
    const area = d.area ?? "不明";
    companyBreakdown[company] = (companyBreakdown[company] ?? 0) + 1;
    areaBreakdown[area] = (areaBreakdown[area] ?? 0) + 1;
  }

  const connection = buildConnectionInfo(date, shifts);

  return NextResponse.json({
    drivers,
    summary: {
      total: drivers.length,
      confirmedCount,
      tentativeCount,
      companyBreakdown,
      areaBreakdown,
    },
    connection,
  });
}
