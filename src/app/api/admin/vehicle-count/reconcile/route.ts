import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { fetchCarioWaveCompletions } from "@/lib/cario/carioWaveDb";
import { getMonthlyVehicleCounts } from "@/lib/kpi/vehicle-count";

/**
 * 稼働実績 差異チェック（管理者専用・read-only）。
 * 当アプリの台数確認表（貼付＝完了台数）と、CARIO 楽天美女木の便完了台数（Supabase wave_completions）を
 * 日×便の台数で突き合わせ、差異のある日×便を返す。CARIOは一切変更しない。
 *
 * GET /api/admin/vehicle-count/reconcile?month=YYYY-MM
 *   → { month, available, reason?, summary, diffs[] }
 *   台数の数え方: 1ドライバー×便 = 1台（driver_id を便ごとに一意化）。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "月形式が不正です（YYYY-MM）" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const last = new Date(y!, m!, 0).getDate();
  const to = `${month}-${String(last).padStart(2, "0")}`;

  // CARIO 側: wave_completions を driver_id×wave で一意化して 日×便 の台数に集計
  const cario = await fetchCarioWaveCompletions(from, to);
  if (!cario.available) {
    return NextResponse.json({
      month, available: false, reason: cario.reason ?? "CARIO_UNAVAILABLE",
      summary: { appTotal: 0, carioTotal: 0, diffCells: 0, matched: false },
      diffs: [],
    });
  }

  // carioCount[date][waveNo] = distinct driver_id 数
  const carioSeen = new Map<string, Set<string>>(); // key: date|wave → driverIds
  for (const r of cario.rows) {
    const key = `${r.workDate}|${r.waveNo}`;
    if (!carioSeen.has(key)) carioSeen.set(key, new Set());
    carioSeen.get(key)!.add(r.driverId);
  }
  const carioCount = (date: string, wave: number) => carioSeen.get(`${date}|${wave}`)?.size ?? 0;

  // アプリ側: 月次台数（貼付＝完了台数）。画面と同じ値を使う。
  const monthly = await getMonthlyVehicleCounts(month);

  // 全日×便を突合。差異(app-cario)!=0 のセルだけ拾う。
  const diffs: { date: string; waveNo: number; app: number; cario: number; diff: number }[] = [];
  let appTotal = 0;
  let carioTotal = 0;
  for (const date of monthly.days) {
    for (let w = 1; w <= 6; w++) {
      const app = monthly.cells[date]?.[w]?.haritsuke ?? 0;
      const cc = carioCount(date, w);
      appTotal += app;
      carioTotal += cc;
      if (app !== cc) diffs.push({ date, waveNo: w, app, cario: cc, diff: app - cc });
    }
  }

  return NextResponse.json({
    month,
    available: true,
    summary: {
      appTotal,
      carioTotal,
      diffCells: diffs.length,
      matched: diffs.length === 0,
    },
    diffs,
  });
}
