import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { CarioApiError } from "@/lib/cario/client";
import { syncCarioAssignments, markRangeStale } from "@/lib/cario/sync";
import { getShiftListPayload } from "@/lib/cario/shift-list";

/**
 * リアルタイム取得エンドポイント（管理画面のポーリング用）。
 *
 * GET /api/shifts/realtime?date=YYYY-MM-DD
 *   1. CARIO から最新 assignments を取得し DB へ同期（audit_log は書かない＝ポーリング頻度でログ肥大させない）
 *   2. 同期後の一覧ペイロードを返す
 *
 * CARIO 失敗時は既存シフトを stale 化し、前回取込データを返す（画面は継続表示）。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付形式が不正です（YYYY-MM-DD）" }, { status: 400 });
  }

  let syncError: string | null = null;
  try {
    await syncCarioAssignments(date);
  } catch (err) {
    if (err instanceof CarioApiError) {
      await markRangeStale(date);
      syncError = err.message; // 安全な文言のみ（キー・URL・個人情報を含まない）
    } else {
      // 予期しないエラーは握りつぶさず前回データは返す（個人情報はログしない）
      console.error("[shifts/realtime] 予期しないエラー:", err instanceof Error ? err.message : "unknown");
      syncError = "最新データの取得に失敗しました";
    }
  }

  const payload = await getShiftListPayload(date);
  return NextResponse.json({
    ...payload,
    syncedAt: new Date().toISOString(),
    syncError,
  });
}
