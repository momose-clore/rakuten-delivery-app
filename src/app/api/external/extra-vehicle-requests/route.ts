import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExternalRequestAuthorized } from "@/lib/external/auth";
import { formatExtraVehicleReport } from "@/lib/line/format";

// 外部連携（CARIO が pull）: 増便申請の取得
//
//   GET /api/external/extra-vehicle-requests
//   Authorization: Bearer <EXTRA_VEHICLE_PULL_TOKEN>
//
//   クエリ:
//     status  … pending|approved|rejected（省略時: 却下以外）
//     since   … ISO8601。この時刻より後に作成された申請のみ（増分pull用）
//     limit   … 最大件数（既定100・上限500）
//
// CARIO はこの結果の reportText を、CARIO公式LINEから専用グループへそのまま投稿する。
// 生レスポンス・トークンはログに出さない（個人情報を含む）。
export async function GET(req: NextRequest) {
  if (!isExternalRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || undefined;
  const sinceParam = sp.get("since");
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "100", 10) || 100, 1), 500);

  let since: Date | undefined;
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (!Number.isNaN(d.getTime())) since = d;
  }

  const rows = await prisma.extraVehicleRequest.findMany({
    where: {
      ...(status ? { status } : { status: { not: "rejected" } }),
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const requests = rows.map((r) => ({
    id: r.id,
    requestDate: r.requestDate.toISOString().split("T")[0],
    depot: r.depot,
    waveNo: r.waveNo,
    vehicleCount: r.vehicleCount,
    assignedDriverName: r.assignedDriverName,
    reason: r.reason,
    status: r.status,
    createdByName: r.createdByName,
    createdByRole: r.createdByRole,
    reportStatus: r.carioSyncStatus,
    createdAt: r.createdAt.toISOString(),
    // CARIO はこの本文を専用グループへそのまま投稿する（増便申請フォーマット）
    reportText: formatExtraVehicleReport({
      requestDate: r.requestDate.toISOString().split("T")[0],
      depot: r.depot,
      waveNo: r.waveNo,
      vehicleCount: r.vehicleCount,
      assignedDriverName: r.assignedDriverName,
      reason: r.reason,
    }),
  }));

  return NextResponse.json({ requests, count: requests.length });
}
