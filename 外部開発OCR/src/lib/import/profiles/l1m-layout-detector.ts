import type { OcrWord } from "../../../lib/ocr/ocrspace";
import { normalizeHeaderText } from "../../../lib/ocr/misread-dictionary";

const L1M_TITLE_KEYWORDS = ["L1M貨物一覧表", "L1M 貨物", "貨物一覧表", "配車予定表"];
const L1M_HEADER_KEYWORDS = ["配車No", "お客様情報", "伝票No", "常温", "クーラー", "ケース数", "荷数計"];

/** L1M配車表かどうかを判定 */
export function isL1MLayout(rawText: string, words: OcrWord[]): boolean {
  // タイトル検出
  for (const kw of L1M_TITLE_KEYWORDS) {
    if (rawText.includes(kw)) return true;
  }

  // ヘッダーキーワードが3つ以上あれば L1M と判断
  let matched = 0;
  for (const word of words) {
    const normalized = normalizeHeaderText(word.text);
    for (const kw of L1M_HEADER_KEYWORDS) {
      if (normalized.includes(kw)) { matched++; break; }
    }
    if (matched >= 3) return true;
  }
  return false;
}

/** 明細テーブル領域を検出（上部メタ情報を除く） */
export function detectDetailTableArea(words: OcrWord[], imageHeight: number): { yMin: number; yMax: number } {
  // 「配車No」または最初の `数字-数字` パターンの y 座標を検出
  for (const word of words.sort((a, b) => a.top - b.top)) {
    const norm = normalizeHeaderText(word.text);
    if (norm.includes("配車No") || /^\d{1,3}-\d{1,2}$/.test(word.text)) {
      return { yMin: Math.max(0, word.top - 10), yMax: imageHeight };
    }
  }
  // fallback: 上位20%をメタ情報エリアとして除外
  return { yMin: imageHeight * 0.2, yMax: imageHeight };
}
