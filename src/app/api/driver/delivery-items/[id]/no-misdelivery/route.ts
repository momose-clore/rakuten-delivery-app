import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

/** クルーが「誤配なし」を確認/解除する（本人担当のみ） */
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
  const { value } = (await req.json()) as { value?: boolean };
  const checked = value !== false; // 既定は true（確認）

  const [assignment, follow] = await Promise.all([
    prisma.assignment.findFirst({ where: { deliveryItemId, driverId } }),
    prisma.deliveryFollow.findFirst({ where: { deliveryItemId, driverId } }),
  ]);
  if (!assignment && !follow) {
    return NextResponse.json({ error: "この配送先にアクセスする権限がありません" }, { status: 403 });
  }

  await prisma.deliveryItem.update({
    where: { id: deliveryItemId },
    data: { noMisdelivery: checked, noMisdeliveryAt: checked ? new Date() : null },
  });

  return NextResponse.json({ success: true, deliveryItemId, noMisdelivery: checked });
}
