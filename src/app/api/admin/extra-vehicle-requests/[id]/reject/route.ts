import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/app/api/extra-vehicle-requests/route";

// POST: 増便申請を却下（ADMIN のみ）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.extraVehicleRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });

  let rejectedReason: string | null = null;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.rejectedReason === "string" && body.rejectedReason.trim()) {
      rejectedReason = body.rejectedReason.trim();
    }
  } catch {
    // 本文なしでも却下は可能
  }

  const updated = await prisma.extraVehicleRequest.update({
    where: { id },
    data: {
      status: "rejected",
      approvedByUserId: session.user.id,
      approvedAt: new Date(),
      rejectedReason,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXTRA_VEHICLE_REQUEST_REJECTED",
      targetType: "extra_vehicle_requests",
      targetId: id,
      status: "rejected",
    },
  });

  return NextResponse.json({ request: toDTO(updated) });
}
