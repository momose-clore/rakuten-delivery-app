import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  const { driverId } = await req.json();

  if (!driverId) return NextResponse.json({ error: "driverId は必須です" }, { status: 400 });

  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "割当が見つかりません" }, { status: 404 });

  const updated = await prisma.assignment.update({
    where: { id },
    data: { driverId },
    include: { driver: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MANUAL_REASSIGN",
      targetType: "assignments",
      targetId: id,
      beforeData: { driverId: existing.driverId },
      afterData: { driverId },
    },
  });

  return NextResponse.json({
    assignmentId: updated.id,
    driverId: updated.driverId,
    driverName: updated.driver.name,
  });
}
