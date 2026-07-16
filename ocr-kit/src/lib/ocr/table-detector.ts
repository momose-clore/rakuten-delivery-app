import type { OcrWord } from "./ocrspace";

export interface TableRegion {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
  detectedByHeader: boolean;
}

// L1M配車表のヘッダー候補（OCRで部分一致を探す）
const HEADER_KEYWORDS = [
  "配車", "伝票", "氏名", "電話", "住所", "常温", "クーラー", "ケース", "総数",
  "車No", "票No", "話番", "オリコン",
];

/**
 * OCR単語座標から帳票（表）領域を自動検出する。
 * 失敗した場合は null を返し、呼び出し側で固定テンプレートに fallback する。
 */
export function detectTableRegion(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number
): TableRegion | null {
  if (words.length < 10) return null;

  // 1. ヘッダー行を探す（複数のヘッダーキーワードが同じy帯にある行）
  const headerRow = findHeaderRow(words);

  if (headerRow) {
    // ヘッダーが見つかった場合、その y座標以降を表領域とする
    const tableWords = words.filter((w) => w.top >= headerRow.yMin - 5);
    if (tableWords.length < 5) return null;

    const xs = tableWords.map((w) => w.left);
    const xsRight = tableWords.map((w) => w.left + w.width);
    const ys = tableWords.map((w) => w.top);
    const ysBottom = tableWords.map((w) => w.top + w.height);

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xsRight);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ysBottom);

    return {
      xMin, xMax, yMin, yMax,
      width: xMax - xMin,
      height: yMax - yMin,
      detectedByHeader: true,
    };
  }

  // 2. ヘッダー未検出 → 全単語の密集領域を推定
  return detectByWordDensity(words, imageWidth, imageHeight);
}

interface HeaderRowInfo {
  yMin: number;
  yMax: number;
  keywordCount: number;
}

function findHeaderRow(words: OcrWord[]): HeaderRowInfo | null {
  // y座標でグループ化して、最もキーワードが多い行を探す
  const tolerance = 15;
  const rowGroups: { yCenter: number; words: OcrWord[] }[] = [];

  for (const w of words) {
    const yCenter = w.top + w.height / 2;
    const existing = rowGroups.find((g) => Math.abs(g.yCenter - yCenter) <= tolerance);
    if (existing) {
      existing.words.push(w);
    } else {
      rowGroups.push({ yCenter, words: [w] });
    }
  }

  let bestRow: HeaderRowInfo | null = null;
  let bestCount = 0;

  for (const group of rowGroups) {
    const text = group.words.map((w) => w.text).join("");
    const count = HEADER_KEYWORDS.filter((kw) => text.includes(kw)).length;
    if (count > bestCount && count >= 3) {
      bestCount = count;
      const tops = group.words.map((w) => w.top);
      const bottoms = group.words.map((w) => w.top + w.height);
      bestRow = {
        yMin: Math.min(...tops),
        yMax: Math.max(...bottoms),
        keywordCount: count,
      };
    }
  }

  return bestRow;
}

function detectByWordDensity(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number
): TableRegion | null {
  // 上下のマージン（タイトル・ページ番号を除外）
  const topMargin = imageHeight * 0.1;
  const bottomMargin = imageHeight * 0.9;
  const leftMargin = imageWidth * 0.02;
  const rightMargin = imageWidth * 0.98;

  const tableWords = words.filter(
    (w) => w.top >= topMargin && w.top <= bottomMargin &&
           w.left >= leftMargin && w.left <= rightMargin
  );

  if (tableWords.length < 5) return null;

  const xs = tableWords.map((w) => w.left);
  const xsRight = tableWords.map((w) => w.left + w.width);
  const ys = tableWords.map((w) => w.top);
  const ysBottom = tableWords.map((w) => w.top + w.height);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xsRight);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ysBottom);

  return {
    xMin, xMax, yMin, yMax,
    width: xMax - xMin,
    height: yMax - yMin,
    detectedByHeader: false,
  };
}

/**
 * 表領域内の相対x座標（0〜100%）に変換
 */
export function toRelativeX(pixelX: number, region: TableRegion): number {
  return ((pixelX - region.xMin) / region.width) * 100;
}
