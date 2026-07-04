import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExternalRequestAuthorized } from "@/lib/external/auth";

// 外部連携（CARIO が pull 後に呼ぶ）: 報告済みマーク
//
//   POST /api/external/extra-vehicle-requests/[id]/ack
//   Authorization: Bearer <EXTRA_VEHICLE_PULL_TOKEN>
//   body(任意): { status?: "sent" | "failed", carioRequestId?: string }
//
// CARIO が公式LINEで専用グループへ投稿したら本APIで報告状態を確定させる。
// 既存の cario_* カラムを報告ステータスとして流用（DBスキーマ不変）。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isExternalRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.extraVehicleRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  let reportStatus: "sent" | "failed" = "sent";
  let carioRequestId: string | null = null;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.status === "failed") reportStatus = "failed";
    if (typeof body.carioRequestId === "string") carioRequestId = body.carioRequestId;
  } catch {
    // body なしなら sent 扱い
  }

  const updated = await prisma.extraVehicleRequest.update({
    where: { id },
    data: {
      carioSyncStatus: reportStatus,
      carioRequestId,
      carioSentAt: reportStatus === "sent" ? new Date() : existing.carioSentAt,
    },
  });

  return NextResponse.json({ id: updated.id, reportStatus: updated.carioSyncStatus });
}
