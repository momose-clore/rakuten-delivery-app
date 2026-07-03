import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/** 配送を応援に追加/解除する（二重ハンドラ・1件単位・ドライバー自由） */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const driverId = session.user.driverId;
  if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });

  const { deliveryItemId, follow } = (await req.json()) as { deliveryItemId?: string; follow?: boolean };
  if (!deliveryItemId) return NextResponse.json({ error: "deliveryItemId が必要です" }, { status: 400 });

  // 自分の担当は応援対象外
  const ownAssignment = await prisma.assignment.findFirst({ where: { deliveryItemId, driverId } });
  if (ownAssignment) return NextResponse.json({ error: "自分の担当配送は応援に追加できません" }, { status: 400 });

  const item = await prisma.deliveryItem.findUnique({ where: { id: deliveryItemId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "配送が見つかりません" }, { status: 404 });

  if (follow === false) {
    await prisma.deliveryFollow.deleteMany({ where: { deliveryItemId, driverId } });
    return NextResponse.json({ success: true, followed: false });
  }

  await prisma.deliveryFollow.upsert({
    where: { deliveryItemId_driverId: { deliveryItemId, driverId } },
    create: { deliveryItemId, driverId },
    update: {},
  });
  return NextResponse.json({ success: true, followed: true });
}
