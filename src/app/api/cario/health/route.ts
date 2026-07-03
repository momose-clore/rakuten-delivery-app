import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { carioHealthCheck } from "@/lib/cario/health";

/**
 * CARIO 連携ヘルスチェック（管理者専用・read-only）。
 * GET /api/cario/health[?driftDate=YYYY-MM-DD]
 *   - 疎通（/sites）・同期鮮度・stale件数を返す
 *   - driftDate 指定時は CARIO と DB のドリフト（欠落/余剰）も返す
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driftDate = req.nextUrl.searchParams.get("driftDate") ?? undefined;
  if (driftDate && !/^\d{4}-\d{2}-\d{2}$/.test(driftDate)) {
    return NextResponse.json({ error: "driftDate の形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const health = await carioHealthCheck({ driftDate });
  return NextResponse.json(health);
}
