import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { proposeVehicleMatches } from "@/lib/cario/vehicle-match";

/**
 * CARIO 号車 ↔ 配送明細 号車 のマッチング提案（管理者専用・read-only）。
 * GET /api/cario/vehicle-matches?date=YYYY-MM-DD
 *
 * ※ 提案のみ返す。実割当（Assignment作成）は行わない。配車側が参照して使う。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const proposal = await proposeVehicleMatches(date);
  return NextResponse.json(proposal);
}
