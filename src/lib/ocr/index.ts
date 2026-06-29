import { prisma } from "@/lib/prisma";
import { storageProvider } from "@/lib/storage";
import { extractTextFromImage } from "./vision";
import { parseDispatchText } from "./parser";
import { validateItem } from "./validator";
import type { OcrRunResult } from "./types";

/**
 * 指定した dispatch_images の OCR を実行する。
 * 個人情報（氏名・電話・住所）はログに出力しない。
 */
export async function runOcr(
  dispatchImageId: string,
  userId: string
): Promise<OcrRunResult> {
  // 1. 画像レコード取得
  const image = await prisma.dispatchImage.findUnique({
    where: { id: dispatchImageId },
  });
  if (!image) throw new Error(`dispatch_images が見つかりません: ${dispatchImageId}`);

  // 2. 処理中ステータスに更新
  await prisma.dispatchImage.update({
    where: { id: dispatchImageId },
    data: { ocrStatus: "PROCESSING" },
  });

  try {
    // 3. 画像バッファ取得（storage 抽象化を経由）
    const buffer = await storageProvider.read(image.imageUrl);

    // 4. Cloud Vision API でテキスト抽出
    const rawText = await extractTextFromImage(buffer);

    // 5. テキストをパース
    const parsed = parseDispatchText(rawText);

    // 6. バリデーション（要確認フラグ付与）
    const validated = parsed.map((item) => ({
      ...item,
      reviewReasons: validateItem(item, parsed),
    }));

    // 7. delivery_items に一括 INSERT
    let reviewCount = 0;
    for (const item of validated) {
      const hasReview = item.reviewReasons.length > 0;
      if (hasReview) reviewCount++;

      await prisma.deliveryItem.create({
        data: {
          dispatchImageId,
          dispatchKey: item.dispatchKey,
          waveNo: item.waveNo,
          vehicleNo: item.vehicleNo,
          deliverySeq: item.deliverySeq,
          invoiceNo: item.invoiceNo,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          address: item.address,
          specialFlag: item.specialFlag,
          normalOriconCount: item.normalOriconCount ?? 0,
          coolerBoxCount: item.coolerBoxCount ?? 0,
          caseCount: item.caseCount ?? 0,
          totalCount: item.totalCount ?? 0,
          memo: item.memo,
          ocrNotes: item.reviewReasons.length > 0
            ? JSON.stringify(item.reviewReasons)
            : null,
          ocrStatus: hasReview ? "REVIEW_REQUIRED" : "PENDING",
          deliveryStatus: "PENDING_OCR",
        },
      });
    }

    // 8. dispatch_images ステータスを更新
    //    OCR完了 = REVIEW_REQUIRED（STEP4で管理者確認後に CONFIRMED）
    await prisma.dispatchImage.update({
      where: { id: dispatchImageId },
      data: { ocrStatus: "REVIEW_REQUIRED" },
    });

    // 9. 操作ログ（個人情報は含めない）
    await prisma.auditLog.create({
      data: {
        userId,
        action: "RUN_OCR",
        targetType: "dispatch_images",
        targetId: dispatchImageId,
        afterData: {
          itemCount: validated.length,
          reviewCount,
        },
      },
    });

    return {
      dispatchImageId,
      itemCount: validated.length,
      reviewCount,
      errorCount: 0,
    };
  } catch (err) {
    // エラー時は ERROR ステータスに更新
    await prisma.dispatchImage.update({
      where: { id: dispatchImageId },
      data: { ocrStatus: "ERROR" },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "RUN_OCR_ERROR",
        targetType: "dispatch_images",
        targetId: dispatchImageId,
        afterData: {
          error: err instanceof Error ? err.message : "不明なエラー",
        },
      },
    });

    throw err;
  }
}
