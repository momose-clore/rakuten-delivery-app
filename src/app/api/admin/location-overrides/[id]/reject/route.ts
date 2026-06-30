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
    data: { status: "rejected" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LOCATION_OVERRIDE_REJECTED",
      targetType: "delivery_location_overrides",
      targetId: id,
      afterData: { status: "rejected" },
    },
  });

  return NextResponse.json({ override: updated });
}
