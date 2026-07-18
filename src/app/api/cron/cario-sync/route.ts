import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { CarioApiError } from "@/lib/cario/client";
import { syncCarioAssignments, markRangeStale, jstDateStr } from "@/lib/cario/sync";
import { syncCarioWaveDb } from "@/lib/cario/completions-sync";

/**
 * CARIO 定期同期 Cron（Vercel Cron から1分間隔で実行）。
 *
 * GET /api/cron/cario-sync
 *   - 認証: Vercel Cron が付与する `Authorization: Bearer <CRON_SECRET>` を検証
 *   - 対象: JST 本日〜+2日 の rolling window（当日＋直近の割当を常に最新化）
 *   - 誰も画面を見ていなくても DB を最新に保つ（ドライバーアプリの DB 読取が常に新鮮）
 *
 * ※ audit_log は1回のみ・件数のみ記録（個人情報・APIキーなし）
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron の認証（CRON_SECRET 必須。未設定なら拒否＝公開させない）
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  const authOk = !!secret && a.length === b.length && timingSafeEqual(a, b);
  if (!authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const from = jstDateStr(0);
  const to = jstDateStr(2);

  try {
    const result = await syncCarioAssignments(from, to);

    // 終了報告（wave完了）も同期。CARIO側未提供(404)/未設定なら available:false で無害に握る。
    let completions: { available: boolean; inserted: number; reason?: string } = { available: false, inserted: 0 };
    try {
      // CARIO Supabase の便完了を直近3日ぶん同期（リアルタイム進捗・遅配予想の素）
      const c = await syncCarioWaveDb(jstDateStr(-2), jstDateStr(0));
      completions = { available: c.available, inserted: c.inserted, reason: c.reason };
    } catch (e) {
      console.error("[cron/cario-sync] completions同期エラー:", e instanceof Error ? e.message : "unknown");
    }

    // ※ audit_log は書かない（AuditLog.userId が必須のため。cron結果はVercelログで追跡）
    return NextResponse.json({
      ok: true,
      from,
      to,
      driverCreated: result.driverCreated,
      driverUpdated: result.driverUpdated,
      shiftUpserted: result.shiftUpserted,
      usedMock: result.usedMock,
      completions,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof CarioApiError) {
      await markRangeStale(from, to);
      return NextResponse.json(
        { ok: false, from, to, error: err.message, staled: true },
        { status: 502 }
      );
    }
    console.error("[cron/cario-sync] 予期しないエラー:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ ok: false, error: "同期に失敗しました" }, { status: 500 });
  }
}
