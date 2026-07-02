import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { date, waveNo, area } = await req.json() as {
    date?: string; waveNo?: string; area?: string;
  };
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

  // 予測値ガード: 配車No不明・住所空欄・NEEDS_REVIEW のチェック
  const problemItems = await prisma.deliveryItem.findMany({
    where: {
      dispatchImageId: { in: imageIds },
      OR: [
        { dispatchKey: null },
        { address: null },
      ],
    },
    select: { id: true, dispatchKey: true, address: true },
  });

  const missingDispatchKey = problemItems.filter((i) => !i.dispatchKey).length;
  const missingAddress     = problemItems.filter((i) => !i.address).length;

  const needsReviewItems = await prisma.deliveryItem.count({
    where: {
      dispatchImageId: { in: imageIds },
      ocrNotes: { contains: "NEEDS_REVIEW" },
    },
  });

  const predictionWarnings: string[] = [];
  if (missingDispatchKey > 0) predictionWarnings.push(`配車No不明: ${missingDispatchKey}件（割当を確認してください）`);
  if (missingAddress > 0)     predictionWarnings.push(`住所空欄: ${missingAddress}件（割当を確認してください）`);
  if (needsReviewItems > 0)   predictionWarnings.push(`要確認残あり: ${needsReviewItems}件`);

  // 未割当件数を確認
  const unassignedCount = await prisma.deliveryItem.count({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: { in: ["PENDING_OCR", "UNASSIGNED"] },
    },
  });

  const assignedCount = await prisma.deliveryItem.count({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: "ASSIGNED",
    },
  });

  // delivery_status を ASSIGNED に統一
  await prisma.deliveryItem.updateMany({
    where: {
      dispatchImageId: { in: imageIds },
      deliveryStatus: { in: ["PENDING_OCR", "UNASSIGNED"] },
      assignments: { some: {} },
    },
    data: { deliveryStatus: "ASSIGNED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CONFIRM_ASSIGNMENTS",
      targetType: "assignments",
      targetId: date,
      afterData: {
        assignedCount,
        unassignedCount,
        predictionWarningCount: predictionWarnings.length,
        missingDispatchKey,
        missingAddress,
        needsReviewItems,
        date,
        waveNo: waveNo ?? null,
        area: area ?? null,
      },
    },
  });

  return NextResponse.json({
    success: true,
    assignedCount,
    unassignedCount,
    predictionWarnings,
    hasPredictionWarnings: predictionWarnings.length > 0,
  });
}
