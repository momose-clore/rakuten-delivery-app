import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getVehicleCountProgress } from "@/lib/kpi/vehicle-count";

/**
 * 台数管理表（wave別 稼働台数の消化進捗・管理者専用・read-only）。
 * GET /api/admin/vehicle-count?date=YYYY-MM-DD
 * → wave別 予定台数/完了台数/増車(フォロー) を返す。実績(assignment/follow)から自動集計。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  return NextResponse.json(await getVehicleCountProgress(date));
}
