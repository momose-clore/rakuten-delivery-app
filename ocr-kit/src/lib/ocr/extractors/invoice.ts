import { correctDigitMisreads, toHalfWidth } from "../misread-dictionary";

export function extractInvoiceNo(raw: string): string | null {
  const cleaned = correctDigitMisreads(toHalfWidth(raw)).replace(/[\s\-\(\)]/g, "");
  const match = cleaned.match(/\d{10,18}/);
  return match ? match[0] : null;
}

/** 混在テキストから伝票Noを抽出 */
export function extractInvoiceFromText(text: string): string | null {
  const cleaned = correctDigitMisreads(toHalfWidth(text)).replace(/[\s\-]/g, "");
  const match = cleaned.match(/\d{10,18}/);
  return match ? match[0] : null;
}
