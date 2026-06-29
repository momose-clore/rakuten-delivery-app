import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const { id: deliveryItemId } = await params;
  const { memo } = await req.json();

  // 本人担当かを DB 側で確認
  const assignment = await prisma.assignment.findFirst({
    where: { deliveryItemId, driverId },
  });
  if (!assignment) {
    return NextResponse.json({ error: "この配送先にアクセスする権限がありません" }, { status: 403 });
  }

  await prisma.deliveryItem.update({
    where: { id: deliveryItemId },
    data: { memo: memo ?? null },
  });

  return NextResponse.json({ success: true, deliveryItemId });
}
