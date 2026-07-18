import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isExternalRequestAuthorized } from "@/lib/external/auth";
import { syncCarioWaveDb } from "@/lib/cario/completions-sync";
import { getVehicleCountProgress } from "@/lib/kpi/vehicle-count";

/**
 * CARIO の便完了（Supabase `wave_completions`・finished_at付き）を取り込む。
 * POST /api/admin/vehicle-count/sync-cario { date?, from?, to? }
 *   - date 指定: その日を同期。from/to 指定: 期間を同期。未指定: JST本日。
 * 認証: 管理者セッション、または Bearer <EXTRA_VEHICLE_PULL_TOKEN>（cron/バックフィル用）。
 * CARIOは読み取りのみ（一切変更しない）。
 */
function todayJst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const isToken = isExternalRequestAuthorized(req);
  if (!isAdmin && !isToken) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  let body: { date?: string; from?: string; to?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body任意 */
  }

  const isYmd = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = isYmd(body.from) ? body.from! : isYmd(body.date) ? body.date! : todayJst();
  const to = isYmd(body.to) ? body.to! : isYmd(body.date) ? body.date! : from;

  const sync = await syncCarioWaveDb(from, to);
  // 単日同期なら最新の台数も返す（画面即反映用）
  const progress = from === to ? await getVehicleCountProgress(from) : null;
  return NextResponse.json({ sync, progress });
}
