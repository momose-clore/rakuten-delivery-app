import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { parsePredictionWarnings } from "@/lib/prediction/metadata";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const image = await prisma.dispatchImage.findUnique({ where: { id } });
  if (!image) return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });

  if (image.ocrStatus === "PENDING" || image.ocrStatus === "PROCESSING") {
    return NextResponse.json({ error: "OCRが完了していません" }, { status: 409 });
  }

  // 予測値ガード: 低信頼・要確認・住所空欄の件数を集計して警告として返す
  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId: id },
    select: {
      id: true,
      address: true,
      ocrNotes: true,
      predictionWarningsJson: true,
      totalCount: true,
      normalOriconCount: true,
      coolerBoxCount: true,
      caseCount: true,
    },
  });

  let emptyAddressCount = 0;
  let needsReviewCount = 0;
  let lowConfidenceCount = 0;
  let autoRescuedCount = 0;
  let countMismatchCount = 0;

  for (const item of items) {
    if (!item.address) emptyAddressCount++;

    const notes: string[] = item.ocrNotes ? (JSON.parse(item.ocrNotes) as string[]) : [];
    if (notes.includes("NEEDS_REVIEW")) needsReviewCount++;
    if (notes.includes("COUNT_MISMATCH")) countMismatchCount++;

    const warnings = parsePredictionWarnings(item.predictionWarningsJson);
    if (warnings.includes("OCR_LOW_CONFIDENCE")) lowConfidenceCount++;
    if (warnings.includes("OCR_AUTO_RESCUED_VALUE")) autoRescuedCount++;
  }

  const predictionWarnings: string[] = [];
  if (emptyAddressCount > 0)  predictionWarnings.push(`住所空欄: ${emptyAddressCount}件`);
  if (needsReviewCount > 0)   predictionWarnings.push(`要確認: ${needsReviewCount}件`);
  if (lowConfidenceCount > 0) predictionWarnings.push(`低信頼値: ${lowConfidenceCount}件`);
  if (autoRescuedCount > 0)   predictionWarnings.push(`自動補正値含む: ${autoRescuedCount}件`);
  if (countMismatchCount > 0) predictionWarnings.push(`数量不一致: ${countMismatchCount}件`);

  // dispatch_images を CONFIRMED に
  await prisma.dispatchImage.update({
    where: { id },
    data: { ocrStatus: "CONFIRMED" },
  });

  // delivery_items を全て CONFIRMED に（ERROR は除く）
  await prisma.deliveryItem.updateMany({
    where: { dispatchImageId: id, ocrStatus: { not: "ERROR" } },
    data: { ocrStatus: "CONFIRMED" },
  });

  // 監査ログ（個人情報を含まない）
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CONFIRM_OCR",
      targetType: "dispatch_images",
      targetId: id,
      afterData: {
        itemCount: items.length,
        predictionWarningCount: predictionWarnings.length,
        emptyAddressCount,
        needsReviewCount,
        lowConfidenceCount,
        autoRescuedCount,
        countMismatchCount,
      },
    },
  });

  return NextResponse.json({
    success: true,
    predictionWarnings,
    hasPredictionWarnings: predictionWarnings.length > 0,
  });
}
