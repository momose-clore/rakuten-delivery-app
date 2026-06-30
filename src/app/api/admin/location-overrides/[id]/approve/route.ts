import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  const updated = await prisma.deliveryLocationOverride.update({
    where: { id },
    data: { status: "approved", approvedBy: session.user.id, approvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LOCATION_OVERRIDE_APPROVED",
      targetType: "delivery_location_overrides",
      targetId: id,
      afterData: { status: "approved" },
    },
  });

  return NextResponse.json({ override: updated });
}
