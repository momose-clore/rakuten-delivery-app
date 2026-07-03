import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { approveStaleShifts } from "@/lib/cario/sync";

/**
 * stale（前回取込）シフトの継続使用を管理者が承認する。
 * CARIO API 失敗時に古いデータで運用を続ける判断を記録する。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date } = (await req.json()) as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  await approveStaleShifts(new Date(date), session.user.id);

  return NextResponse.json({ success: true, sourceStatus: "USER_APPROVED" });
}
