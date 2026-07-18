/**
 * 画像OCRコア（自己完結版・DB非依存）
 *
 * 元アプリ `src/lib/ocr/index.ts` の runOcr から、DB保存/使用量ログ/監査ログ/ストレージ読取を除去し、
 * 「画像バッファ → 構造化行(NormalizedDispatchRow[])」だけを行う純粋関数にしたもの。
 *
 * パイプライン:
 *   OCR.space(座標付き) → 画像前処理 → 表領域検出 → グリッド検出/列補正 →
 *   行マッピング → データ行抽出 → 項目抽出 → 信頼度評価
 */
import { runOcrSpace } from "./lib/ocr/ocrspace";
import { preprocessImageForOcr } from "./lib/ocr/image-preprocess";
import { assessImageQuality } from "./lib/ocr/image-quality";
import { detectTableRegion } from "./lib/ocr/table-detector";
import { detectGrid } from "./lib/ocr/grid-detector";
import { calibrateColumnsByGrid } from "./lib/ocr/cell-mapper";
import { mapWordsToRows, filterDataRows } from "./lib/ocr/layout-mapper";
import { extractItemFromRow } from "./lib/ocr/field-extractor";
import { assessConfidence, type Confidence } from "./lib/ocr/confidence";
import type { DispatchImportSource, NormalizedDispatchRow } from "./types/import";

export interface RecognizeOptions {
  /** 取込ソース種別（デフォルト image_ocr）。PDFのラスタ画像なら pdf_ocr を渡す */
  source?: DispatchImportSource;
  /** OCR.space に渡す MIME（画像は image/jpeg、PDFは application/pdf） */
  mime?: string;
  /** 画像前処理(CLAHE/高解像度化)をスキップしたい場合 true */
  skipPreprocess?: boolean;
}

export interface RecognizeResult {
  rows: NormalizedDispatchRow[];
  /** ヘッダから読み取れた配送日/エリア/便（あれば） */
  header: { deliveryDate: string | null; area: string | null; waveNo: string | null };
  /** 全体信頼度（high/medium/low） */
  overallConfidence: Confidence;
  /** 画像品質スコア（0-100・評価できた場合） */
  qualityScore: number | null;
  /** OCR生テキスト */
  rawText: string;
}

/** 画像/PDFバッファをOCRして構造化行に変換する（DB書き込みなし） */
export async function recognizeDispatchImage(
  imageBuffer: Buffer,
  options: RecognizeOptions = {}
): Promise<RecognizeResult> {
  const source: DispatchImportSource = options.source ?? "image_ocr";
  const mime = options.mime ?? "image/jpeg";

  // 画像品質評価（失敗しても続行）
  const qualityReport = await assessImageQuality(imageBuffer).catch(() => null);

  const buffer = options.skipPreprocess ? imageBuffer : await preprocessImageForOcr(imageBuffer);

  // OCR.space 実行（座標付き）
  const ocrResult = await runOcrSpace(buffer, mime);

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

  const rows: NormalizedDispatchRow[] = extracted.map((item, i) => {
    const { confidence, reasons } = assessConfidence(item, extracted);
    return {
      source,
      rowNo: i + 1,
      deliveryDate: header.deliveryDate ?? undefined,
      area: header.area ?? undefined,
      waveNo: item.waveNo ?? header.waveNo ?? undefined,
      dispatchKey: item.dispatchKey,
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
      confidence,
      notes: reasons,
    };
  });

  const overallConfidence: Confidence =
    rows.length > 0 && rows.every((r) => r.confidence === "high") ? "high"
    : rows.some((r) => r.confidence === "low") ? "low" : "medium";

  return {
    rows,
    header: {
      deliveryDate: header.deliveryDate,
      area: header.area,
      waveNo: header.waveNo,
    },
    overallConfidence,
    qualityScore: qualityReport?.score ?? null,
    rawText: ocrResult.parsedText,
  };
}

/** OCR生テキストから配送日/エリア/便を推定（元 index.ts の extractHeaderInfo 相当） */
function extractHeaderInfo(rawText: string): {
  deliveryDate: string | null;
  area: string | null;
  waveNo: string | null;
} {
  const dateMatch = rawText.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  let deliveryDate: string | null = null;
  if (dateMatch) {
    const iso = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) deliveryDate = iso;
  }
  const waveMatch = rawText.match(/\b(W[1-6])\b/i);
  const waveNo = waveMatch ? waveMatch[1].toUpperCase() : null;
  const areaMatch = rawText.match(/([^\s\d]{2,8})\s+W[1-6]/i);
  const area = areaMatch ? areaMatch[1].trim() : null;
  return { deliveryDate, area, waveNo };
}
