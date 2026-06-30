/**
 * 自動救済パイプライン
 * 低信頼行を人間修正前提にせず、自動補正を先に実行する。
 */
import type { NormalizedDispatchRow } from "@/types/import";
import { extractDispatchKey } from "@/lib/ocr/extractors/dispatch-key";
import { extractInvoiceNo } from "@/lib/ocr/extractors/invoice";
import { extractPhone } from "@/lib/ocr/extractors/phone";
import { extractAddress } from "@/lib/ocr/extractors/address";
import { extractCounts } from "@/lib/ocr/extractors/counts";
import { correctAddressMisreads } from "@/lib/ocr/misread-dictionary";
import { prisma } from "@/lib/prisma";

export async function autoRescueRows(rows: NormalizedDispatchRow[]): Promise<NormalizedDispatchRow[]> {
  const rescued: NormalizedDispatchRow[] = [];

  for (const row of rows) {
    const notes = [...row.notes];
    let wasRescued = false;

    // 1. 配車No再試行
    if (!row.dispatchKey) {
      const retried = extractDispatchKey([row.invoiceNo ?? "", row.memo ?? ""].join(" "), row.waveNo);
      if (retried) {
        (row as NormalizedDispatchRow).dispatchKey = retried;
        notes.push("AUTO_CORRECTED_BY_HISTORY");
        wasRescued = true;
      }
    }

    // 2. 伝票No再試行（住所・メモから抽出）
    if (!row.invoiceNo) {
      const retried = extractInvoiceNo([row.address ?? "", row.memo ?? ""].join(" "));
      if (retried) {
        (row as NormalizedDispatchRow).invoiceNo = retried;
        wasRescued = true;
      }
    }

    // 3. 電話番号が住所に混入していた場合の救済
    if (!row.customerPhone && row.address) {
      const { value, valid } = extractPhone(row.address);
      if (valid && value) {
        (row as NormalizedDispatchRow).customerPhone = value;
        // 住所から電話番号部分を除去
        const cleaned = extractAddress(row.address.replace(value, "")).value;
        if (cleaned) (row as NormalizedDispatchRow).address = cleaned;
        wasRescued = true;
      }
    }

    // 4. 住所地名誤読補正
    if (row.address) {
      const { value: corrected, corrected: wasCorrected } = correctAddressMisreads(row.address);
      if (wasCorrected) {
        (row as NormalizedDispatchRow).address = corrected;
        wasRescued = true;
      }
    }

    // 5. 数量合計の自動補完
    if (row.totalCount === 0 && (row.normalOriconCount + row.coolerBoxCount + row.caseCount) > 0) {
      const { totalCount, totalAutoFilled } = extractCounts(
        String(row.normalOriconCount),
        String(row.coolerBoxCount),
        String(row.caseCount),
        ""  // 空 → 自動補完
      );
      if (totalAutoFilled && totalCount !== null) {
        (row as NormalizedDispatchRow).totalCount = totalCount;
        notes.push("AUTO_CORRECTED_BY_HISTORY");
        wasRescued = true;
      }
    }

    // 6. 修正履歴による安全補正
    if (row.dispatchKey) {
      try {
        const pattern = await prisma.ocrCorrectionPattern.findUnique({
          where: { fieldName_beforeValue: { fieldName: "dispatchKey", beforeValue: row.dispatchKey } },
        });
        if (pattern && pattern.usageCount >= 2) {
          (row as NormalizedDispatchRow).dispatchKey = pattern.afterValue;
          if (!notes.includes("AUTO_CORRECTED_BY_HISTORY")) notes.push("AUTO_CORRECTED_BY_HISTORY");
          wasRescued = true;
        }
      } catch { /* ignore */ }
    }

    // 7. 最終バリデーション後に confidence 更新
    const finalNotes = notes.filter((n, i, a) => a.indexOf(n) === i);
    const criticalMissing = !row.dispatchKey || !row.address;
    const confidence = criticalMissing ? "low" : finalNotes.length === 0 ? "high" : "medium";

    rescued.push({
      ...row,
      notes: criticalMissing ? [...finalNotes, "NEEDS_REVIEW"] : finalNotes,
      confidence,
      autoRescued: wasRescued,
    });
  }

  return rescued;
}
