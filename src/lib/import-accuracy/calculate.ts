/**
 * 取込精度メトリクス計算（毎回 delivery_items から再集計）
 * prediction_summary_json は参考値のみ
 */
import { prisma } from "@/lib/prisma";
import { OCR_DERIVED_FIELDS } from "@/lib/prediction/metadata";
import type { FieldStatusMap } from "@/types/prediction";

export interface ImportAccuracyMetrics {
  dispatchImageId:       string;
  totalItemCount:        number;
  totalFieldCount:       number;
  confirmedFieldCount:   number;
  autoRescuedFieldCount: number;
  manualFixedFieldCount: number;
  adminApprovedFieldCount: number;
  needsReviewFieldCount: number;
  lowConfidenceFieldCount: number;
  estimatedFieldCount:   number;
  noMetadataItemCount:   number;  // JSON カラムが null（既存データ）
  accuracyPercent:       number;  // confirmed / total
}

/** delivery_items から取込精度を再集計 */
export async function calculateImportAccuracy(
  dispatchImageId: string
): Promise<ImportAccuracyMetrics> {
  const items = await prisma.deliveryItem.findMany({
    where: { dispatchImageId },
    select: {
      id: true,
      fieldStatusJson: true,
      predictionWarningsJson: true,
    },
  });

  const FIELDS = OCR_DERIVED_FIELDS as readonly string[];
  const totalFieldCount = items.length * FIELDS.length;

  let confirmedCount   = 0;
  let autoRescuedCount = 0;
  let manualFixedCount = 0;
  let adminApprovedCount = 0;
  let needsReviewCount = 0;
  let lowConfCount     = 0;
  let estimatedCount   = 0;
  let noMetadataCount  = 0;

  for (const item of items) {
    if (!item.fieldStatusJson) {
      noMetadataCount++;
      continue;
    }

    const statusMap: FieldStatusMap = JSON.parse(item.fieldStatusJson) as FieldStatusMap;

    for (const fieldName of FIELDS) {
      const status = statusMap[fieldName];
      if (!status) continue;
      switch (status) {
        case "CONFIRMED":      confirmedCount++;    break;
        case "AUTO_RESCUED":   autoRescuedCount++;  break;
        case "MANUAL_FIXED":   manualFixedCount++;  break;
        case "ADMIN_APPROVED": adminApprovedCount++; break;
        case "NEEDS_REVIEW":   needsReviewCount++;  break;
        case "ESTIMATED":      estimatedCount++;    break;
      }
    }

    // 低信頼警告カウント
    if (item.predictionWarningsJson) {
      const warnings: string[] = JSON.parse(item.predictionWarningsJson) as string[];
      if (warnings.includes("OCR_LOW_CONFIDENCE")) lowConfCount++;
    }
  }

  const confirmedFields = confirmedCount + manualFixedCount + adminApprovedCount;
  const accuracyPercent = totalFieldCount > 0
    ? Math.round((confirmedFields / totalFieldCount) * 100)
    : 0;

  return {
    dispatchImageId,
    totalItemCount:         items.length,
    totalFieldCount,
    confirmedFieldCount:    confirmedCount,
    autoRescuedFieldCount:  autoRescuedCount,
    manualFixedFieldCount:  manualFixedCount,
    adminApprovedFieldCount: adminApprovedCount,
    needsReviewFieldCount:  needsReviewCount,
    lowConfidenceFieldCount: lowConfCount,
    estimatedFieldCount:    estimatedCount,
    noMetadataItemCount:    noMetadataCount,
    accuracyPercent,
  };
}
