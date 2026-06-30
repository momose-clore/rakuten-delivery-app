/**
 * PDF 取込パーサー
 * テキストレイヤーがある場合は直接抽出、スキャンPDFはOCR.spaceへ渡す
 */
import type { NormalizedDispatchRow } from "@/types/import";
import { parsePasteText } from "@/lib/import/paste/paste-parser";

// pdf-parse は DOMMatrix 等ブラウザAPIを参照するため動的インポートで遅延ロード
async function getPdfParse() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
}

export interface PdfParseResult {
  text: string;
  isScanned: boolean;
  pageCount: number;
}

/** PDF バッファからテキスト抽出 */
export async function extractPdfText(buffer: Buffer): Promise<PdfParseResult> {
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buffer);
    const text = data.text as string;
    const isScanned = text.replace(/\s/g, "").length < 50;
    return { text, isScanned, pageCount: data.numpages as number };
  } catch {
    return { text: "", isScanned: true, pageCount: 1 };
  }
}

/** PDFテキストから配送明細をパース */
export async function parsePdfBuffer(
  buffer: Buffer,
  defaultWaveNo?: string
): Promise<{ rows: NormalizedDispatchRow[]; source: "pdf_text" | "pdf_ocr" }> {
  const { text, isScanned } = await extractPdfText(buffer);

  if (!isScanned && text.length > 50) {
    const rows = parsePasteText(text, defaultWaveNo);
    return { rows: rows.map((r) => ({ ...r, source: "pdf_text" as const })), source: "pdf_text" };
  }

  // スキャンPDF: TODO - ページを画像化してOCR.spaceへ渡す
  // 現状はテキスト抽出結果をそのまま返す
  return { rows: [], source: "pdf_ocr" };
}
