import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, waveNo, area } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付を指定してください（YYYY-MM-DD）" }, { status: 400 });
  }

  const deliveryDate = new Date(date);

  const images = await prisma.dispatchImage.findMany({
    where: {
      deliveryDate,
      ocrStatus: "CONFIRMED",
      ...(area && { area }),
      ...(waveNo && { waveNo }),
    },
  });
  const imageIds = images.map((i) => i.id);

  // 未割当件数を確認
  const unassignedCount = await prisma.deliveryItem.count({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: { in: ["PENDING_OCR", "UNASSIGNED"] },
    },
  });

  // 割当済み件数を確認
  const assignedCount = await prisma.deliveryItem.count({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: "ASSIGNED",
    },
  });

  // delivery_status を ASSIGNED に統一（割当済みでないものを更新）
  await prisma.deliveryItem.updateMany({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: { in: ["PENDING_OCR", "UNASSIGNED"] },
      assignments: { some: {} }, // assignment が存在するもののみ
    },
    data: { deliveryStatus: "ASSIGNED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CONFIRM_ASSIGNMENTS",
      targetType: "assignments",
      targetId: date,
      afterData: { assignedCount, unassignedCount, date, waveNo: waveNo ?? null, area: area ?? null },
    },
  });

  return NextResponse.json({ success: true, assignedCount, unassignedCount });
}
