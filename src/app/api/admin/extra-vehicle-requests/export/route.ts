import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { buildRequestFilter } from "@/app/api/extra-vehicle-requests/route";
import { STATUS_LABEL, REPORT_STATUS_LABEL } from "@/types/extra-vehicle-request";
import type {
  ExtraVehicleRequestStatus,
  CarioSyncStatus,
} from "@/types/extra-vehicle-request";

// GET: 増便申請をCSVで出力（ADMIN のみ）。一覧と同じ絞り込み（status/depot/from/to）に対応。
// 個人情報を含む可能性があるためログには出さない（ダウンロードのみ）。
function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  // ダブルクオートで囲み、内部の " を "" にエスケープ（改行・カンマも安全に）
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const rows = await prisma.extraVehicleRequest.findMany({
    where: buildRequestFilter(req.nextUrl.searchParams),
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "対象日", "対象デポ", "該当便", "台数", "ドライバー名",
    "申請者", "申請者種別", "ステータス", "報告状態", "申請理由", "作成日時",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.requestDate.toISOString().split("T")[0]),
      csvCell(r.depot),
      csvCell(r.waveNo),
      csvCell(r.vehicleCount),
      csvCell(r.assignedDriverName),
      csvCell(r.createdByName),
      csvCell(r.createdByRole === "ADMIN" ? "管理者" : "ドライバー"),
      csvCell(STATUS_LABEL[r.status as ExtraVehicleRequestStatus] ?? r.status),
      csvCell(REPORT_STATUS_LABEL[r.carioSyncStatus as CarioSyncStatus] ?? r.carioSyncStatus),
      csvCell(r.reason),
      csvCell(r.createdAt.toISOString()),
    ].join(","));
  }

  // Excelで文字化けしないよう BOM 付与
  const body = "﻿" + lines.join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="extra-vehicle-requests.csv"`,
    },
  });
}
