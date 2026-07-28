import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isExternalRequestAuthorized } from "@/lib/external/auth";
import { parseExtraVehicleLine } from "@/lib/cario/parseExtraVehicleLine";
import { saveManualCount, MANUAL_ZOSHA } from "@/lib/kpi/vehicle-count";

/**
 * 「楽天マート 増車申請」LINEエクスポートから **美女木の増便のみ** を取り込む。
 * POST /api/admin/vehicle-count/import-extra-line { text, dryRun? }
 *   - dryRun=true（既定）: 解析結果（便別台数）を返すだけ（プレビュー）
 *   - dryRun=false      : 増車(手入力上書き)として反映
 * 認証: 管理者セッション or Bearer <EXTRA_VEHICLE_PULL_TOKEN>。
 * ※ 手書き形式のため誤抽出があり得る。必ずプレビューで確認してから反映する想定。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const isToken = isExternalRequestAuthorized(req);
  if (!isAdmin && !isToken) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  let body: { text?: string; dryRun?: boolean };
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

  const parsed = parseExtraVehicleLine(text);
  const cells = Object.entries(parsed.byCell)
    .map(([k, count]) => { const [date, w] = k.split("|"); return { date: date!, waveNo: Number(w), count }; })
    .sort((a, b) => a.date.localeCompare(b.date) || a.waveNo - b.waveNo);

  if (cells.length === 0) {
    return NextResponse.json({ error: "美女木の増便が見つかりませんでした" }, { status: 422 });
  }

  const dryRun = body.dryRun !== false; // 既定はプレビュー
  if (dryRun) {
    return NextResponse.json({ applied: false, dates: parsed.dates, cells });
  }

  // 反映（増車の手入力上書き）
  const who = session?.user.name ?? "LINE増車取込";
  for (const c of cells) {
    await saveManualCount(c.date, c.waveNo, MANUAL_ZOSHA, c.count, who);
  }
  return NextResponse.json({ applied: true, dates: parsed.dates, cells });
}
