import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getDailyKpi } from "@/lib/kpi/daily-summary";

/**
 * 日次KPIサマリ（管理者専用・read-only）。
 * GET /api/admin/kpi/summary?date=YYYY-MM-DD
 *
 * 稼働ドライバー数 / 完了率 / オンタイム率 / 遅配（実績・進行中）/ Wave別 / ドライバー別 を返す。
 * ダッシュボード(item4)は fetch するだけ。遅配判定は src/lib/waves.ts（単一真実源）。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const kpi = await getDailyKpi(date);
  return NextResponse.json(kpi);
}
