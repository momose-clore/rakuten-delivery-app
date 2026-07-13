import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getMonthlyVehicleCounts } from "@/lib/kpi/vehicle-count";
import { buildVehicleCountWorkbook } from "@/lib/kpi/vehicle-count-xlsx";

/**
 * 台数確認表を Excel(.xlsx) でダウンロード（管理者専用）。
 * GET /api/admin/vehicle-count/export?month=YYYY-MM
 *   → 「③デポ美女木 台数管理表」と同じセル配置の月次 .xlsx を返す。
 *      貼付=完了台数(実績) / SP=手動入力 / 増車=フォロー。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "月の形式が不正です（YYYY-MM）" }, { status: 400 });
  }

  const data = await getMonthlyVehicleCounts(month);
  const buf = buildVehicleCountWorkbook(data);

  const fileName = `美女木デポ_台数確認表_${month}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
