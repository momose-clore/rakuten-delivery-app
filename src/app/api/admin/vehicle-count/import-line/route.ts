import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isExternalRequestAuthorized } from "@/lib/external/auth";
import { importLineCompletions } from "@/lib/cario/completions-sync";

/**
 * LINEトーク履歴エクスポート(.txt本文)から「ウェーブ終了（帰庫/業務終了NW完了）」を取り込む。
 * POST /api/admin/vehicle-count/import-line { text, from? }
 *   - text: LINEエクスポート本文
 *   - from: "YYYY-MM-DD" 任意。指定日より前は取り込まない（例: 6月除外 = "2026-07-01"）
 *
 * 認証: 管理者セッション、または Bearer <EXTRA_VEHICLE_PULL_TOKEN>（本番バックフィル/自動投入用）。
 * → 群【楽天ネットスーパー美女木】の CARIO投稿を解析 → wave_completions(source=LINE) を日付ごと全刷新。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const isToken = isExternalRequestAuthorized(req);
  if (!isAdmin && !isToken) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let body: { text?: string; from?: string };
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
  const from = typeof body.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.from) ? body.from : undefined;

  const result = await importLineCompletions(text, { from });
  if (result.dates.length === 0) {
    return NextResponse.json({ error: "帰庫（ウェーブ終了）の記録が見つかりませんでした" }, { status: 422 });
  }
  return NextResponse.json(result);
}
