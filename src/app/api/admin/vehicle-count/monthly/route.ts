import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getMonthlyVehicleCounts } from "@/lib/kpi/vehicle-count";

/**
 * 台数確認表の月次一覧（Excelと同じ並び・管理者専用・read-only）。
 * GET /api/admin/vehicle-count/monthly?month=YYYY-MM
 *   → { month, days[], cells[day][waveNo]{haritsuke,sp,zosha} }
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "月の形式が不正です（YYYY-MM）" }, { status: 400 });
  }

  return NextResponse.json(await getMonthlyVehicleCounts(month));
}
