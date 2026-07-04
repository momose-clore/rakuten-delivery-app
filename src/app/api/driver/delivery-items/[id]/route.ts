import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/**
 * クルーが配送先を削除する。
 * - 本人担当（assignment）の配送 → 明細・割当・フォローごと削除（取込ミス/重複の掃除用）
 * - フォロー中だけの配送 → フォロー解除のみ（他ドライバーの本来配送は消さない）
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const { id: deliveryItemId } = await params;

  const assignment = await prisma.assignment.findFirst({ where: { deliveryItemId, driverId } });
  if (assignment) {
    // 本人担当 → 明細ごと削除（割当・フォローも巻き取り）
    await prisma.$transaction([
      prisma.deliveryFollow.deleteMany({ where: { deliveryItemId } }),
      prisma.assignment.deleteMany({ where: { deliveryItemId } }),
      prisma.deliveryItem.delete({ where: { id: deliveryItemId } }),
    ]);
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DRIVER_DELETE_DELIVERY",
        targetType: "delivery_items",
        targetId: deliveryItemId,
      },
    });
    return NextResponse.json({ success: true, deleted: "item", deliveryItemId });
  }

  const follow = await prisma.deliveryFollow.findFirst({ where: { deliveryItemId, driverId } });
  if (follow) {
    await prisma.deliveryFollow.delete({ where: { id: follow.id } });
    return NextResponse.json({ success: true, deleted: "follow", deliveryItemId });
  }

  return NextResponse.json({ error: "この配送先を削除する権限がありません" }, { status: 403 });
}
