import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { routeGroupId, loadingMode, returnToWarehouse } = await req.json();
  if (!routeGroupId) return NextResponse.json({ error: "routeGroupId は必須です" }, { status: 400 });
  if (!["SIMULTANEOUS", "SPLIT"].includes(loadingMode)) {
    return NextResponse.json({ error: "loadingMode は SIMULTANEOUS または SPLIT を指定してください" }, { status: 400 });
  }

  const existing = await prisma.routeGroup.findUnique({ where: { id: routeGroupId } });
  if (!existing) return NextResponse.json({ error: "RouteGroup が見つかりません" }, { status: 404 });

  const updated = await prisma.routeGroup.update({
    where: { id: routeGroupId },
    data: {
      loadingMode,
      ...(returnToWarehouse !== undefined && { returnToWarehouse }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_LOADING_MODE",
      targetType: "route_groups",
      targetId: routeGroupId,
      beforeData: { loadingMode: existing.loadingMode, returnToWarehouse: existing.returnToWarehouse },
      afterData: { loadingMode: updated.loadingMode, returnToWarehouse: updated.returnToWarehouse },
    },
  });

  return NextResponse.json({ routeGroup: updated });
}
