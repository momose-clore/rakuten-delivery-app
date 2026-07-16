/**
 * ocr-kit — 配送表OCR/取込エンジン（自己完結モジュール）
 *
 * 楽天スーパー配送アプリの OCR/取込パイプラインを、DB(Prisma)・Next.js・NextAuth 依存なしで
 * 切り出したもの。「ファイル(PDF/画像/CSV/Excel/貼付テキスト) → 構造化行(NormalizedDispatchRow[])」
 * を提供する。
 *
 * エンジン方針:
 *   - OCR は OCR.space のみ（Gemini/Vision/Tesseract は含めない）
 *   - 本番相当では環境変数 OCR_SPACE_API_KEY 必須（未設定はデモキー fallback＝開発時のみ）
 *
 * 使い方:
 *   import { configure, parseDispatchFile } from "ocr-kit";
 *   configure({ apiKey: process.env.OCR_SPACE_API_KEY });
 *   const { rows } = await parseDispatchFile({ buffer, filename: "haisha.pdf" });
 */

import { recognizeDispatchImage, type RecognizeResult } from "./core";
import { parseCsvText } from "./lib/import/csv/csv-parser";
import { parseExcelBuffer } from "./lib/import/csv/excel-parser";
import { parsePasteText } from "./lib/import/paste/paste-parser";
import { parsePdfBuffer } from "./lib/import/pdf/pdf-parser";
import { autoRescueRows } from "./lib/import/auto-rescue";
import type { DispatchImportSource, NormalizedDispatchRow } from "./types/import";

// ---- 公開API（低レベル） -------------------------------------------------
export { recognizeDispatchImage } from "./core";
export type { RecognizeOptions, RecognizeResult } from "./core";
export { runOcrSpace } from "./lib/ocr/ocrspace";
export type { OcrWord, OcrSpaceResult } from "./lib/ocr/ocrspace";
export { parseCsvText } from "./lib/import/csv/csv-parser";
export { parseExcelBuffer } from "./lib/import/csv/excel-parser";
export { parsePasteText } from "./lib/import/paste/paste-parser";
export { parsePdfBuffer, extractPdfText } from "./lib/import/pdf/pdf-parser";
export { applyL1MProfile } from "./lib/import/profiles/l1m-cargo-list-profile";
export type { L1MOcrInput } from "./lib/import/profiles/l1m-cargo-list-profile";
export { autoRescueRows } from "./lib/import/auto-rescue";
export type { RescuedRow, CorrectionLookup, AutoRescueOptions } from "./lib/import/auto-rescue";

// 型の再エクスポート
export type {
  NormalizedDispatchRow,
  ImportBatchResult,
  DispatchImportSource,
  ImportConfidence,
  L1MMetadata,
  LayoutProfile,
} from "./types/import";

// ---- 設定 ---------------------------------------------------------------
export interface ConfigureOptions {
  /** OCR.space APIキー。渡すと process.env.OCR_SPACE_API_KEY に設定する */
  apiKey?: string;
}

/** OCR.space APIキー等を設定する（環境変数 OCR_SPACE_API_KEY を使う場合は不要） */
export function configure(options: ConfigureOptions = {}): void {
  if (options.apiKey) process.env.OCR_SPACE_API_KEY = options.apiKey;
}

// ---- 統合エントリ: ファイル種別を自動判別して取り込む ----------------------
export interface ParseFileInput {
  /** ファイル内容 */
  buffer: Buffer;
  /** ファイル名（拡張子で種別判定に使う） */
  filename?: string;
  /** MIME（filename より優先して種別判定に使う） */
  mimeType?: string;
  /** ヘッダで便が取れない場合の既定 Wave（例 "W3"） */
  defaultWaveNo?: string;
  /** 画像/スキャンPDFをカメラ由来として扱うなら "camera_ocr" */
  imageSource?: Extract<DispatchImportSource, "image_ocr" | "camera_ocr">;
}

export interface ParseFileResult {
  rows: NormalizedDispatchRow[];
  source: DispatchImportSource;
  /** OCR経由のときのみ付与される付帯情報 */
  ocr?: Omit<RecognizeResult, "rows">;
}

type Kind = "csv" | "excel" | "pdf" | "image" | "unknown";

function detectKind(filename?: string, mimeType?: string): Kind {
  const mt = (mimeType ?? "").toLowerCase();
  if (mt.includes("csv")) return "csv";
  if (mt.includes("spreadsheet") || mt.includes("excel")) return "excel";
  if (mt === "application/pdf") return "pdf";
  if (mt.startsWith("image/")) return "image";

  const ext = (filename ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"].includes(ext)) return "image";
  return "unknown";
}

/**
 * ファイルを種別自動判定して構造化行に取り込む主エントリ。
 * - CSV/Excel: テキスト解析
 * - PDF: まずテキスト抽出。スキャンPDF(テキストなし)なら OCR.space(PDFエンジン)へフォールバック
 * - 画像: OCR.space（座標付き）
 */
export async function parseDispatchFile(input: ParseFileInput): Promise<ParseFileResult> {
  const kind = detectKind(input.filename, input.mimeType);
  const imageSource: DispatchImportSource = input.imageSource ?? "image_ocr";

  switch (kind) {
    case "csv":
      return { rows: parseCsvText(input.buffer.toString("utf8"), input.defaultWaveNo), source: "csv" };

    case "excel":
      return { rows: parseExcelBuffer(input.buffer, input.defaultWaveNo), source: "excel" };

    case "pdf": {
      const { rows, source } = await parsePdfBuffer(input.buffer, input.defaultWaveNo);
      // テキストPDFで行が取れたらそれを返す
      if (rows.length > 0) return { rows, source };
      // スキャンPDF → OCR.space(PDF)へフォールバック
      const res = await recognizeDispatchImage(input.buffer, {
        source: "pdf_ocr",
        mime: "application/pdf",
      });
      const { rows: ocrRows, ...ocr } = res;
      return { rows: ocrRows, source: "pdf_ocr", ocr };
    }

    case "image": {
      const res = await recognizeDispatchImage(input.buffer, { source: imageSource, mime: input.mimeType });
      const { rows, ...ocr } = res;
      return { rows, source: imageSource, ocr };
    }

    default:
      // 不明: 貼付テキストとして解釈を試みる
      return { rows: parsePasteText(input.buffer.toString("utf8"), input.defaultWaveNo), source: "paste" };
  }
}

/** 取り込んだ行に自動救済（低信頼値の自動補正）を適用する薄いラッパ */
export async function parseDispatchFileWithRescue(
  input: ParseFileInput
): Promise<ParseFileResult & { rescuedRows: Awaited<ReturnType<typeof autoRescueRows>> }> {
  const result = await parseDispatchFile(input);
  const rescuedRows = await autoRescueRows(result.rows);
  return { ...result, rescuedRows };
}
