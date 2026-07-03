import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { CarioApiError } from "@/lib/cario/client";
import { fetchCarioSites } from "@/lib/cario/getSites";

/**
 * CARIO 現場一覧を返す（管理者専用）。
 * GET /api/cario/sites → { sites: CarioSite[] }
 * 複数現場フィルタ（assignments の site_id 絞り込み）用の選択肢として利用する。
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  try {
    const sites = await fetchCarioSites();
    return NextResponse.json({ sites });
  } catch (err) {
    if (err instanceof CarioApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "現場一覧の取得に失敗しました" }, { status: 502 });
  }
}
