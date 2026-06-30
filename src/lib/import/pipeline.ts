/**
 * 共通正規化パイプライン
 * PDF/CSV/Excel/貼り付け/画像OCR/スマホカメラOCR → NormalizedDispatchRow[]
 */
import { prisma } from "@/lib/prisma";
import type { NormalizedDispatchRow, ImportBatchResult, DispatchImportSource } from "@/types/import";

/** 正規化済み行をDBに保存する共通処理 */
export async function saveImportBatch(
  result: ImportBatchResult,
  userId: string
): Promise<string> {
  const batch = await prisma.dispatchImportBatch.create({
    data: {
      sourceType: result.source,
      status: "review",
      totalRows: result.totalRows,
      highCount: result.highCount,
      mediumCount: result.mediumCount,
      lowCount: result.lowCount,
      autoRescuedCount: result.autoRescuedCount,
      needsReviewCount: result.needsReviewCount,
      qualityScore: result.qualityScore ?? null,
      qualityLevel: result.qualityLevel ?? null,
      layoutProfile: result.layoutProfile ?? null,
      depotName: result.depotName ?? null,
      waveNo: result.waveNo ?? null,
      vehicleNo: result.vehicleNo ?? null,
      deliveryDate: result.deliveryDate ? new Date(result.deliveryDate) : null,
    },
  });

  // dispatch_images レコードを作成（既存フローとの互換性）
  const dateVal = result.deliveryDate ? new Date(result.deliveryDate) : new Date();
  const dispatchImage = await prisma.dispatchImage.create({
    data: {
      deliveryDate: dateVal,
      area: result.depotName ?? null,
      waveNo: result.waveNo ?? null,
      imageUrl: result.source === "image_ocr" || result.source === "camera_ocr"
        ? "" : `import:${batch.id}`,
      ocrStatus: "REVIEW_REQUIRED",
      ocrProvider: result.source,
    },
  });

  // delivery_items を一括 INSERT
  for (const row of result.rows) {
    const item = await prisma.deliveryItem.create({
      data: {
        dispatchImageId: dispatchImage.id,
        dispatchKey: row.dispatchKey,
        waveNo: row.waveNo ?? null,
        vehicleNo: row.dispatchKey?.split("-")[1] ?? null,
        deliverySeq: row.dispatchKey ? parseInt(row.dispatchKey.split("-").pop() ?? "0", 10) : null,
        invoiceNo: row.invoiceNo,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        address: row.address,
        specialFlag: row.specialFlag ?? null,
        normalOriconCount: row.normalOriconCount,
        coolerBoxCount: row.coolerBoxCount,
        caseCount: row.caseCount,
        totalCount: row.totalCount,
        memo: row.memo ?? null,
        ocrNotes: row.notes.length > 0 ? JSON.stringify(row.notes) : null,
        ocrStatus: row.notes.length > 0 ? "REVIEW_REQUIRED" : "PENDING",
        deliveryStatus: "PENDING_OCR",
      },
    });

    await prisma.dispatchImportRow.create({
      data: {
        batchId: batch.id,
        deliveryItemId: item.id,
        rowNo: row.rowNo,
        sourceType: row.source,
        confidence: row.confidence,
        notes: row.notes.length > 0 ? JSON.stringify(row.notes) : null,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "IMPORT_DISPATCH_BATCH",
      targetType: "dispatch_import_batches",
      targetId: batch.id,
      afterData: {
        source: result.source,
        totalRows: result.totalRows,
        layoutProfile: result.layoutProfile ?? null,
      },
    },
  });

  return batch.id;
}

/** 統計を計算 */
export function calcBatchStats(rows: NormalizedDispatchRow[]) {
  return {
    totalRows: rows.length,
    highCount: rows.filter((r) => r.confidence === "high").length,
    mediumCount: rows.filter((r) => r.confidence === "medium").length,
    lowCount: rows.filter((r) => r.confidence === "low").length,
    autoRescuedCount: rows.filter((r) => r.autoRescued).length,
    needsReviewCount: rows.filter((r) => r.notes.includes("NEEDS_REVIEW")).length,
  };
}
