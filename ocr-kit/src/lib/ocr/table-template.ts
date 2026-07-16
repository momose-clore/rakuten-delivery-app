import type { OcrWord } from "./ocrspace";

export type FieldName =
  | "dispatchKey"
  | "invoiceNo"
  | "customerName"
  | "customerPhone"
  | "address"
  | "specialFlag"
  | "normalOricon"
  | "coolerBox"
  | "caseCount"
  | "totalCount"
  | "memo";

export interface ColumnDef {
  name: FieldName;
  label: string;
  xMin: number;
  xMax: number;
  type: "text" | "number" | "phone" | "address" | "dispatchKey" | "invoiceNo";
  priority: number;
  headerKeywords: string[];  // ヘッダーアンカー検出用
}

/** L1M 配車予定表の固定テンプレート（fallback 用） */
export const L1M_COLUMNS: ColumnDef[] = [
  { name: "dispatchKey",   label: "配車No",       xMin: 0,  xMax: 8,   type: "dispatchKey", priority: 1,  headerKeywords: ["配車", "車No"] },
  { name: "invoiceNo",     label: "伝票No",       xMin: 8,  xMax: 25,  type: "invoiceNo",   priority: 2,  headerKeywords: ["伝票", "票No"] },
  { name: "customerName",  label: "氏名",         xMin: 25, xMax: 40,  type: "text",        priority: 3,  headerKeywords: ["氏名", "名前"] },
  { name: "customerPhone", label: "電話番号",     xMin: 40, xMax: 55,  type: "phone",       priority: 4,  headerKeywords: ["電話", "連絡先"] },
  { name: "address",       label: "住所",         xMin: 55, xMax: 76,  type: "address",     priority: 5,  headerKeywords: ["住所"] },
  { name: "specialFlag",   label: "特記",         xMin: 76, xMax: 79,  type: "text",        priority: 6,  headerKeywords: ["特記", "特殊"] },
  { name: "normalOricon",  label: "常温オリコン", xMin: 79, xMax: 83,  type: "number",      priority: 7,  headerKeywords: ["常温", "オリコン"] },
  { name: "coolerBox",     label: "クーラー",     xMin: 83, xMax: 87,  type: "number",      priority: 8,  headerKeywords: ["クーラー", "クーラ"] },
  { name: "caseCount",     label: "ケース",       xMin: 87, xMax: 91,  type: "number",      priority: 9,  headerKeywords: ["ケース"] },
  { name: "totalCount",    label: "総数",         xMin: 91, xMax: 95,  type: "number",      priority: 10, headerKeywords: ["総数", "合計"] },
  { name: "memo",          label: "メモ",         xMin: 95, xMax: 100, type: "text",        priority: 11, headerKeywords: ["メモ", "備考"] },
];

/**
 * ヘッダーアンカーによる列境界補正
 * OCR単語からヘッダーキーワードを探し、検出できたもので列境界を補正する。
 * 検出できない列は固定テンプレートを維持。
 */
export function calibrateColumnsByHeader(
  words: OcrWord[],
  relativeXFn: (px: number) => number
): ColumnDef[] {
  const calibrated = L1M_COLUMNS.map((col) => ({ ...col }));

  // ヘッダー行を探す（上位20%の y 位置に集中している単語群）
  const totalHeight = Math.max(...words.map((w) => w.top + w.height));
  const headerZoneY = totalHeight * 0.25;
  const headerWords = words.filter((w) => w.top <= headerZoneY);

  if (headerWords.length < 3) return calibrated;

  // 各列のヘッダーキーワードを検索
  for (const col of calibrated) {
    for (const kw of col.headerKeywords) {
      const match = headerWords.find((w) => w.text.includes(kw));
      if (match) {
        const xRelCenter = relativeXFn(match.left + match.width / 2);
        const colWidth = col.xMax - col.xMin;
        // 検出位置を中心に列境界を微調整（±10% 以内に限定）
        const shift = xRelCenter - (col.xMin + colWidth / 2);
        if (Math.abs(shift) < 10) {
          col.xMin = Math.max(0, col.xMin + shift);
          col.xMax = Math.min(100, col.xMax + shift);
        }
        break;
      }
    }
  }

  return calibrated;
}

/** x座標（相対 0〜100）→ 列定義 */
export function getColumnByXPct(xPct: number, columns: ColumnDef[]): ColumnDef | null {
  return columns.find((c) => xPct >= c.xMin && xPct < c.xMax) ?? null;
}

/** x座標（ピクセル）→ 列定義（固定テンプレート使用） */
export function getColumnByX(xPixel: number, imageWidth: number): ColumnDef | null {
  const xPct = (xPixel / imageWidth) * 100;
  return getColumnByXPct(xPct, L1M_COLUMNS);
}
