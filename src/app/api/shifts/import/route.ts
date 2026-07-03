import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { CarioApiError, getCarioConnectionMode, isProductionMock } from "@/lib/cario/client";
import { syncCarioAssignments, markRangeStale } from "@/lib/cario/sync";
import type { ImportSummary } from "@/lib/cario/types";

/**
 * 手動取込（管理画面の「CARIOシフト取込」ボタン）。
 * 共有コア syncCarioAssignments を使用し、監査ログ（件数のみ）を記録する。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, to, siteId } = (await req.json()) as { date?: string; to?: string; siteId?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "終了日の形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }
  if (to && to < date) {
    return NextResponse.json({ error: "終了日は開始日以降にしてください" }, { status: 400 });
  }

  const connectionMode = getCarioConnectionMode();
  const productionMock = isProductionMock();

  let result;
  try {
    result = await syncCarioAssignments(date, to, siteId);
  } catch (err) {
    if (err instanceof CarioApiError) {
      await markRangeStale(date, to);
      const httpStatus = err.type === "TIMEOUT" ? 504 : 502;
      return NextResponse.json(
        { error: err.message, isStale: true, connectionMode },
        { status: httpStatus }
      );
    }
    return NextResponse.json({ error: "CARIOデータの取得に失敗しました" }, { status: 502 });
  }

  const summary: ImportSummary = {
    date,
    driverUpserted: result.driverCreated + result.driverUpdated,
    shiftUpserted: result.shiftUpserted,
    confirmedCount: result.confirmedCount,
    tentativeCount: result.tentativeCount,
    absentCount: result.absentCount,
    companyBreakdown: result.companyBreakdown,
    areaBreakdown: result.areaBreakdown,
    connectionMode,
    isStale: false,
    mapperWarnings: result.warnings.length > 0 ? result.warnings : undefined,
  };

  // 操作ログ（件数のみ・個人情報なし・APIキーなし）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPORT_CARIO_SHIFTS",
      targetType: "shifts",
      targetId: date,
      afterData: {
        driverUpserted: summary.driverUpserted,
        shiftUpserted: summary.shiftUpserted,
        confirmedCount: summary.confirmedCount,
        tentativeCount: summary.tentativeCount,
        absentCount: summary.absentCount,
        connectionMode,
        usedMock: result.usedMock,
      },
    },
  });

  return NextResponse.json({
    success: true,
    summary,
    connectionMode,
    usedMock: result.usedMock,
    isProductionMock: productionMock,
    mapperWarnings: result.warnings.length > 0 ? result.warnings : undefined,
  });
}
