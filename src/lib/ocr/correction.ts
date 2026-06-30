/**
 * OCR修正履歴学習
 *
 * 管理者がOCR確認画面で修正した内容を記録し、
 * 次回同じパターンが出たときに自動補正する。
 *
 * 注意:
 * - 個人情報（住所・氏名・電話）は完全一致パターンのみ（汎用辞書化しない）
 * - 安全なフィールド（dispatchKey・invoiceNo・数量）は積極的に学習
 * - AUTO_CORRECTED_BY_HISTORY を ocr_notes に記録
 */
import { prisma } from "@/lib/prisma";

// 自動補正を許可するフィールド（個人情報フィールドは慎重に）
const AUTO_CORRECT_FIELDS = ["dispatchKey", "invoiceNo", "normalOriconCount", "coolerBoxCount", "caseCount", "totalCount"] as const;
type AutoCorrectField = typeof AUTO_CORRECT_FIELDS[number];

/** 修正を記録する */
export async function recordCorrection(
  fieldName: string,
  beforeValue: string,
  afterValue: string
): Promise<void> {
  if (!beforeValue || !afterValue || beforeValue === afterValue) return;

  await prisma.ocrCorrectionPattern.upsert({
    where: { fieldName_beforeValue: { fieldName, beforeValue } },
    update: { afterValue, usageCount: { increment: 1 } },
    create: { fieldName, beforeValue, afterValue, patternType: "exact", usageCount: 1 },
  });
}

/** 値に自動補正パターンが適用できるか確認し、適用する */
export async function applyCorrections(
  fieldName: string,
  value: string | null
): Promise<{ corrected: string | null; wasAutoCorrect: boolean }> {
  if (!value || !AUTO_CORRECT_FIELDS.includes(fieldName as AutoCorrectField)) {
    return { corrected: value, wasAutoCorrect: false };
  }

  const pattern = await prisma.ocrCorrectionPattern.findUnique({
    where: { fieldName_beforeValue: { fieldName, beforeValue: value } },
  });

  if (pattern && pattern.usageCount >= 2) {
    return { corrected: pattern.afterValue, wasAutoCorrect: true };
  }

  return { corrected: value, wasAutoCorrect: false };
}

/** PATCH /api/ocr-review/[id]/items/[itemId] から呼ぶ */
export async function recordItemCorrections(
  before: Record<string, string | null>,
  after: Record<string, string | null>
): Promise<void> {
  for (const [field, afterVal] of Object.entries(after)) {
    const beforeVal = before[field];
    if (beforeVal && afterVal && beforeVal !== afterVal) {
      await recordCorrection(field, beforeVal, afterVal).catch(() => {});
    }
  }
}
