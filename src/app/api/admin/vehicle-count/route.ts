import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getVehicleCountProgress, saveSpManual } from "@/lib/kpi/vehicle-count";

/**
 * 台数確認表（wave別 稼働台数の消化進捗・管理者専用）。
 * GET  /api/admin/vehicle-count?date=YYYY-MM-DD
 *   → wave別 予定台数/完了台数(貼付)/SP(手動)/増車(フォロー) を返す。実績から自動集計。
 * POST /api/admin/vehicle-count { date, waveNo(1-6), sp }
 *   → SP手動入力値を保存（貼付・増車は自動集計のため変更不可）。
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  let body: { date?: string; waveNo?: number; sp?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const { date, waveNo, sp } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }
  if (typeof waveNo !== "number" || waveNo < 1 || waveNo > 6) {
    return NextResponse.json({ error: "waveNo は 1〜6 で指定してください" }, { status: 400 });
  }
  if (typeof sp !== "number" || !Number.isFinite(sp) || sp < 0) {
    return NextResponse.json({ error: "SP は 0 以上の数値で指定してください" }, { status: 400 });
  }

  await saveSpManual(date, waveNo, sp, session.user.name ?? undefined);
  return NextResponse.json(await getVehicleCountProgress(date));
}
