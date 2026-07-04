import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDeliveryTimingSummary } from "@/lib/delivery/timing-summary";

/**
 * 遅配（Wave締切超過）サマリ（管理者専用・read-only）。
 * GET /api/delivery-timing/summary?date=YYYY-MM-DD
 *
 * Wave別に total/completed/lateCompleted(遅配実績)/overdueActive(進行中遅配)/soon/onTime を返す。
 * ダッシュボード・進捗の「遅配パネル」用。判定は src/lib/waves.ts（単一真実源）。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const summary = await getDeliveryTimingSummary(date);
  return NextResponse.json(summary);
}
