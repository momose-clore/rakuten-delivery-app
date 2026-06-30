import { prisma } from "@/lib/prisma";
import { storageProvider } from "@/lib/storage";
import { runOcrSpace } from "./ocrspace";
import { preprocessImageForOcr } from "./image-preprocess";
import { assessImageQuality } from "./image-quality";
import { detectTableRegion } from "./table-detector";
import { detectGrid } from "./grid-detector";
import { calibrateColumnsByGrid } from "./cell-mapper";
import { mapWordsToRows, filterDataRows } from "./layout-mapper";
import { extractItemFromRow } from "./field-extractor";
import { assessConfidence } from "./confidence";
import { computeImageHash } from "./hash";
import { logOcrUsage, checkDailyLimit } from "./usage";
import type { OcrRunResult } from "./types";

export interface OcrRunOptions { forceReOcr?: boolean; }

export async function runOcr(
  dispatchImageId: string,
  userId: string,
  options: OcrRunOptions = {}
): Promise<OcrRunResult> {
  const image = await prisma.dispatchImage.findUnique({ where: { id: dispatchImageId } });
  if (!image) throw new Error(`dispatch_images not found: ${dispatchImageId}`);

  const limitCheck = await checkDailyLimit();
  if (!limitCheck.ok) throw new Error(`OCR.space 日次上限（${limitCheck.limit}回）到達`);

  await prisma.dispatchImage.update({ where: { id: dispatchImageId }, data: { ocrStatus: "PROCESSING" } });

  try {
    const rawBuffer = await storageProvider.read(image.imageUrl);

    // 画像品質評価
    const qualityReport = await assessImageQuality(rawBuffer).catch(() => null);

    const buffer = await preprocessImageForOcr(rawBuffer);
    const imageHash = computeImageHash(rawBuffer);

    // 重複チェック
    if (!options.forceReOcr && image.imageHash === imageHash) {
      const existing = await prisma.deliveryItem.count({ where: { dispatchImageId } });
      if (existing > 0) {
        await logOcrUsage({ dispatchImageId, imageHash, status: "skipped" });
        await prisma.dispatchImage.update({ where: { id: dispatchImageId }, data: { ocrStatus: "REVIEW_REQUIRED" } });
        return { dispatchImageId, itemCount: existing, reviewCount: 0, errorCount: 0 };
      }
    }

    // OCR.space 実行（座標付き）
    const ocrResult = await runOcrSpace(buffer);

    const header = extractHeaderInfo(ocrResult.parsedText);

    // 表領域検出
    const region = detectTableRegion(ocrResult.words, ocrResult.imageWidth, ocrResult.imageHeight);

    // グリッド検出 → 列境界補正
    const grid = detectGrid(ocrResult.words, ocrResult.imageWidth, ocrResult.imageHeight);
    if (grid.detected) {
      calibrateColumnsByGrid(grid, ocrResult.imageWidth);
    }

    // 行列マッピング
    const allRows = mapWordsToRows(ocrResult.words, ocrResult.imageWidth, ocrResult.imageHeight, region);
    const dataRows = filterDataRows(allRows);

    // フィールド抽出 + confidence 評価
    const extracted = dataRows.map((row) => extractItemFromRow(row, header.waveNo));
    const assessed = extracted.map((item) => {
      const { confidence, reasons } = assessConfidence(item, extracted);
      return { ...item, reviewReasons: reasons, _confidence: confidence };
    });

    if (options.forceReOcr) await prisma.deliveryItem.deleteMany({ where: { dispatchImageId } });

    let reviewCount = 0;
    for (const item of assessed) {
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
          ocrNotes: hasReview ? JSON.stringify(item.reviewReasons) : null,
          ocrStatus: hasReview ? "REVIEW_REQUIRED" : "PENDING",
          deliveryStatus: "PENDING_OCR",
        },
      });
    }

    const overallConf = assessed.every((a) => a._confidence === "high") ? "high"
      : assessed.some((a) => a._confidence === "low") ? "low" : "medium";

    await prisma.dispatchImage.update({
      where: { id: dispatchImageId },
      data: {
        ocrStatus: "REVIEW_REQUIRED",
        ocrProvider: "ocrspace",
        imageHash,
        ...(options.forceReOcr ? { reOcrCount: { increment: 1 } } : {}),
        ...(header.deliveryDate ? { deliveryDate: header.deliveryDate } : {}),
        ...(header.area ? { area: header.area } : {}),
        ...(header.waveNo ? { waveNo: header.waveNo } : {}),
      },
    });

    await logOcrUsage({
      dispatchImageId, imageHash,
      status: options.forceReOcr ? "reocr" : "success",
      confidence: overallConf,
      itemCount: assessed.length,
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: options.forceReOcr ? "RE_OCR" : "RUN_OCR",
        targetType: "dispatch_images",
        targetId: dispatchImageId,
        afterData: {
          provider: "ocrspace",
          itemCount: assessed.length,
          reviewCount,
          confidence: overallConf,
          tableRegionDetected: !!region,
          gridDetected: grid.detected,
          qualityScore: qualityReport?.score ?? null,
        },
      },
    });

    return { dispatchImageId, itemCount: assessed.length, reviewCount, errorCount: 0 };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "不明なエラー";
    await prisma.dispatchImage.update({ where: { id: dispatchImageId }, data: { ocrStatus: "ERROR" } });
    await logOcrUsage({ dispatchImageId, status: "error", errorMessage: msg });
    throw err;
  }
}

function extractHeaderInfo(rawText: string) {
  const dateMatch = rawText.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  let deliveryDate: Date | null = null;
  if (dateMatch) {
    const d = new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`);
    if (!isNaN(d.getTime())) deliveryDate = d;
  }
  const waveMatch = rawText.match(/\b(W[1-6])\b/i);
  const waveNo = waveMatch ? waveMatch[1].toUpperCase() : null;
  const areaMatch = rawText.match(/([^\s\d]{2,8})\s+W[1-6]/i);
  const area = areaMatch ? areaMatch[1].trim() : null;
  return { deliveryDate, area, waveNo };
}
