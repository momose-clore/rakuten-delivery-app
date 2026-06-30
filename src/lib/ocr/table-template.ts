/**
 * L1M 配車表テンプレート定義
 *
 * 列境界は画像幅に対する割合（0〜100）で定義。
 * OCR.space で取得した単語 x 座標をこの割合に変換して列を判定する。
 *
 * 実際の配車表レイアウトを確認して調整すること。
 */

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
  xMin: number;   // 画像幅に対する割合 0-100
  xMax: number;
  type: "text" | "number" | "phone" | "address" | "dispatchKey" | "invoiceNo";
  priority: number; // 低いほど優先（列重複時）
}

/**
 * L1M 配車予定表の列定義
 * ※ 実際の帳票を計測して精度を上げること
 * ※ 環境変数 L1M_COLUMNS_JSON で上書き可能（将来拡張）
 */
export const L1M_COLUMNS: ColumnDef[] = [
  { name: "dispatchKey",    label: "配車No",       xMin: 0,  xMax: 8,   type: "dispatchKey", priority: 1 },
  { name: "invoiceNo",      label: "伝票No",       xMin: 8,  xMax: 25,  type: "invoiceNo",   priority: 2 },
  { name: "customerName",   label: "氏名",         xMin: 25, xMax: 40,  type: "text",        priority: 3 },
  { name: "customerPhone",  label: "電話番号",     xMin: 40, xMax: 55,  type: "phone",       priority: 4 },
  { name: "address",        label: "住所",         xMin: 55, xMax: 76,  type: "address",     priority: 5 },
  { name: "specialFlag",    label: "特記",         xMin: 76, xMax: 79,  type: "text",        priority: 6 },
  { name: "normalOricon",   label: "常温オリコン", xMin: 79, xMax: 83,  type: "number",      priority: 7 },
  { name: "coolerBox",      label: "クーラー",     xMin: 83, xMax: 87,  type: "number",      priority: 8 },
  { name: "caseCount",      label: "ケース",       xMin: 87, xMax: 91,  type: "number",      priority: 9 },
  { name: "totalCount",     label: "総数",         xMin: 91, xMax: 95,  type: "number",      priority: 10 },
  { name: "memo",           label: "メモ",         xMin: 95, xMax: 100, type: "text",        priority: 11 },
];

/** x座標（ピクセル）→ 列定義 を返す */
export function getColumnByX(xPixel: number, imageWidth: number): ColumnDef | null {
  const xPct = (xPixel / imageWidth) * 100;
  return L1M_COLUMNS.find((c) => xPct >= c.xMin && xPct < c.xMax) ?? null;
}
