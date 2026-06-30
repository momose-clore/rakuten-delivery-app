import type { FieldName } from "@/lib/ocr/table-template";

const HEADER_ALIASES: Record<FieldName, string[]> = {
  dispatchKey:    ["配車no", "配車ｎｏ", "配車番号", "配車no.", "dispatch", "車no"],
  invoiceNo:      ["伝票no", "伝票ｎｏ", "伝票番号", "伝票no.", "invoice"],
  customerName:   ["氏名", "名前", "お客様名", "customer", "name"],
  customerPhone:  ["電話", "電話番号", "連絡先", "tel", "phone"],
  address:        ["住所", "お届け先住所", "住所１", "address"],
  specialFlag:    ["特記", "特殊", "特殊フラグ", "flag"],
  normalOricon:   ["常温", "オリコン", "常温オリコン", "常温数"],
  coolerBox:      ["クーラー", "冷蔵", "冷凍", "クーラーbox", "cooler"],
  caseCount:      ["ケース", "ケース数", "case"],
  totalCount:     ["総数", "合計", "荷数計", "荷数", "total"],
  memo:           ["メモ", "備考", "note", "memo"],
};

/** ヘッダー文字列からフィールド名を推定 */
export function mapHeader(raw: string): FieldName | null {
  const norm = raw.toLowerCase().replace(/[\s　]/g, "").replace(/[Ａ-Ｚａ-ｚ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (norm.includes(alias.toLowerCase())) {
        return field as FieldName;
      }
    }
  }
  return null;
}

/** ヘッダー行を検出してフィールドマッピングを返す */
export function detectHeaderRow(rows: string[][]): { headerIdx: number; mapping: Record<number, FieldName> } | null {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const mapping: Record<number, FieldName> = {};
    let matched = 0;
    for (let j = 0; j < rows[i].length; j++) {
      const field = mapHeader(rows[i][j]);
      if (field) { mapping[j] = field; matched++; }
    }
    if (matched >= 3) return { headerIdx: i, mapping };
  }
  return null;
}
