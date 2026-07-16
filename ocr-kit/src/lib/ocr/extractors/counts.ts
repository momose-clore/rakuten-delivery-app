import { correctDigitMisreads, toHalfWidth } from "../misread-dictionary";

export interface CountsResult {
  normalOricon: number | null;
  coolerBox: number | null;
  caseCount: number | null;
  totalCount: number | null;
  totalAutoFilled: boolean;
}

/** 数量列から数値を抽出（O→0, l→1 補正付き） */
export function extractCountValue(raw: string): number | null {
  const cleaned = correctDigitMisreads(toHalfWidth(raw)).replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return n <= 9999 ? n : null;
}

/**
 * 4数量を抽出し、総数が空の場合は自動補完
 */
export function extractCounts(
  normalRaw: string,
  coolerRaw: string,
  caseRaw: string,
  totalRaw: string
): CountsResult {
  const normalOricon = extractCountValue(normalRaw);
  const coolerBox = extractCountValue(coolerRaw);
  const caseCount = extractCountValue(caseRaw);
  let totalCount = extractCountValue(totalRaw);
  let totalAutoFilled = false;

  // 総数が空で、他の3つが揃っている場合は自動補完
  if (totalCount === null && normalOricon !== null && coolerBox !== null && caseCount !== null) {
    totalCount = normalOricon + coolerBox + caseCount;
    totalAutoFilled = true;
  }

  return { normalOricon, coolerBox, caseCount, totalCount, totalAutoFilled };
}
