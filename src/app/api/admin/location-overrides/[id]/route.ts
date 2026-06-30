import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const updated = await prisma.deliveryLocationOverride.update({
    where: { id },
    data: {
      lat: body.lat ?? undefined,
      lng: body.lng ?? undefined,
      entranceMemo: body.entranceMemo ?? undefined,
      buildingMemo: body.buildingMemo ?? undefined,
      nameplateMemo: body.nameplateMemo ?? undefined,
      accessMemo: body.accessMemo ?? undefined,
      cautionMemo: body.cautionMemo ?? undefined,
      parkingMemo: body.parkingMemo ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LOCATION_OVERRIDE_UPDATED",
      targetType: "delivery_location_overrides",
      targetId: id,
      afterData: { fields: Object.keys(body) },
    },
  });

  return NextResponse.json({ override: updated });
}
