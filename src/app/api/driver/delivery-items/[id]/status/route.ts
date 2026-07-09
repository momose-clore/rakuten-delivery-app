import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = ["COMPLETED", "ABSENT", "RETURNED", "SKIPPED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

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
  const { status } = await req.json();

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status は ${ALLOWED_STATUSES.join(" / ")} のいずれかを指定してください` },
      { status: 400 }
    );
  }

  // 本人担当 or 応援（フォロー）中かを DB 側で確認
  const [assignment, follow, item] = await Promise.all([
    prisma.assignment.findFirst({ where: { deliveryItemId, driverId } }),
    prisma.deliveryFollow.findFirst({ where: { deliveryItemId, driverId } }),
    prisma.deliveryItem.findUnique({ where: { id: deliveryItemId }, select: { deliveredAt: true } }),
  ]);
  if (!assignment && !follow) {
    return NextResponse.json({ error: "この配送先にアクセスする権限がありません" }, { status: 403 });
  }

  // 配達完了時刻（確定値）: COMPLETED で初回のみ記録し以後不変。完了取り消し時は null に戻す。
  const deliveredAt =
    status === "COMPLETED" ? (item?.deliveredAt ?? new Date()) : null;

  await prisma.deliveryItem.update({
    where: { id: deliveryItemId },
    data: { deliveryStatus: status as AllowedStatus, deliveredAt },
  });

  return NextResponse.json({ success: true, deliveryItemId, status });
}
