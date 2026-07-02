/**
 * L1M貨物一覧表 専用プロファイル
 * OCR結果から L1M 専用の高精度解析を実行する。
 */
import type { OcrWord } from "@/lib/ocr/ocrspace";
import type { ImportBatchResult } from "@/types/import";
import { isL1MLayout } from "./l1m-layout-detector";
import { extractL1MMetadata } from "./l1m-metadata-extractor";
import { parseL1MRowBlocks } from "./l1m-row-block-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { calcBatchStats } from "@/lib/import/pipeline";

export interface L1MOcrInput {
  parsedText: string;
  words: OcrWord[];
  imageWidth: number;
  imageHeight: number;
  source: "image_ocr" | "camera_ocr";
}

/** L1M プロファイルを適用してバッチ結果を返す */
export async function applyL1MProfile(input: L1MOcrInput): Promise<ImportBatchResult | null> {
  if (!isL1MLayout(input.parsedText, input.words)) return null;

  const meta = extractL1MMetadata(input.parsedText);
  const rawRows = parseL1MRowBlocks(
    input.words, input.imageWidth, input.imageHeight, meta
  );

  // 自動救済
  const rescuedRows = await autoRescueRows(rawRows);

  // 右上総数との整合チェック
  if (meta.summaryTotalCount && meta.summaryTotalCount > 0) {
    const itemTotal = rescuedRows.reduce((s, r) => s + r.totalCount, 0);
    if (itemTotal !== meta.summaryTotalCount) {
      rescuedRows.forEach((r) => {
        if (!r.notes.includes("NEEDS_REVIEW")) r.notes.push("SUMMARY_COUNT_MISMATCH" as string);
      });
    }
  }

  const stats = calcBatchStats(rescuedRows);

  return {
    batchId: "",  // pipeline.saveImportBatch で付与
    source: input.source,
    ...stats,
    rows: rescuedRows,
    layoutProfile: "l1m_cargo_list",
    depotName: meta.depotName,
    waveNo: meta.waveNo,
    vehicleNo: meta.vehicleNo,
    deliveryDate: meta.deliveryDate,
  };
}
