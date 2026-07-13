import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { syncCarioCompletions } from "@/lib/cario/completions-sync";
import { getVehicleCountProgress } from "@/lib/kpi/vehicle-count";

/**
 * CARIO の終了報告（wave完了）を取り込む（管理者専用）。
 * POST /api/admin/vehicle-count/sync-cario { date: "YYYY-MM-DD" }
 *   → その日の CARIO 完了を pull → wave_completions を全刷新 → 最新の台数を返す。
 * CARIO側エンドポイント未提供時は available:false（画面は既存表示を維持）。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  let body: { date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const sync = await syncCarioCompletions(date);
  const progress = await getVehicleCountProgress(date);
  return NextResponse.json({ sync, progress });
}
