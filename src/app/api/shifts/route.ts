import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getShiftListPayload } from "@/lib/cario/shift-list";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  const payload = await getShiftListPayload(date);
  return NextResponse.json(payload);
}
