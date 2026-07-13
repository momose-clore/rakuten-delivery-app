import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { importLineCompletions } from "@/lib/cario/completions-sync";

/**
 * LINEトーク履歴エクスポート(.txt本文)から「ウェーブ終了（帰庫）」を取り込む（管理者専用）。
 * POST /api/admin/vehicle-count/import-line { text }
 *   → 群【楽天ネットスーパー美女木】の CARIO投稿(帰庫)を解析 → wave_completions(source=LINE) を
 *      含まれる日付ごとに全刷新。過去日の台数(貼付)をバックフィルする用途。
 * CARIO API(当日/source=CARIO)とは分離管理するため相互に上書きしない。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const text = body.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "LINEエクスポート本文を貼り付けてください" }, { status: 400 });
  }
  if (text.length > 5_000_000) {
    return NextResponse.json({ error: "本文が大きすぎます（5MBまで）" }, { status: 413 });
  }

  const result = await importLineCompletions(text);
  if (result.dates.length === 0) {
    return NextResponse.json({ error: "帰庫（ウェーブ終了）の記録が見つかりませんでした" }, { status: 422 });
  }
  return NextResponse.json(result);
}
