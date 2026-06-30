import type { OcrWord } from "./ocrspace";
import { getColumnByX, type FieldName } from "./table-template";

export interface MappedRow {
  rowIndex: number;
  yCenter: number;
  cells: Partial<Record<FieldName, string[]>>;
}

const ROW_TOLERANCE_PCT = 2; // 画像高さの 2% 以内を同じ行とみなす

/**
 * OCR単語座標 → テーブル行列構造に変換
 *
 * 1. y座標でクラスタリング（同じ行グループ化）
 * 2. 各単語を x座標 → 列定義にマッピング
 */
export function mapWordsToRows(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number
): MappedRow[] {
  if (words.length === 0) return [];

  const tolerance = imageHeight * (ROW_TOLERANCE_PCT / 100);

  // y座標でソート
  const sorted = [...words].sort((a, b) => a.top - b.top);

  // 行グループ化
  const rowGroups: OcrWord[][] = [];
  let currentGroup: OcrWord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    const groupTopAvg = currentGroup.reduce((s, g) => s + g.top, 0) / currentGroup.length;
    if (Math.abs(w.top - groupTopAvg) <= tolerance) {
      currentGroup.push(w);
    } else {
      rowGroups.push(currentGroup);
      currentGroup = [w];
    }
  }
  if (currentGroup.length > 0) rowGroups.push(currentGroup);

  // 各行の単語を列にマッピング
  return rowGroups.map((group, idx) => {
    const yCenter = group.reduce((s, w) => s + w.top + w.height / 2, 0) / group.length;
    const cells: Partial<Record<FieldName, string[]>> = {};

    // 左から右へ処理
    const sortedGroup = [...group].sort((a, b) => a.left - b.left);

    for (const word of sortedGroup) {
      const col = getColumnByX(word.left + word.width / 2, imageWidth);
      if (col) {
        if (!cells[col.name]) cells[col.name] = [];
        cells[col.name]!.push(word.text);
      }
    }

    return { rowIndex: idx, yCenter, cells };
  });
}

/** 行から配車No または 伝票No が含まれるものだけ抽出（データ行判定） */
export function filterDataRows(rows: MappedRow[]): MappedRow[] {
  return rows.filter((row) => {
    const dk = row.cells.dispatchKey?.join("") ?? "";
    const inv = row.cells.invoiceNo?.join("") ?? "";
    // 配車No（数字-数字形式）or 伝票No（10桁以上の数字）が含まれる行
    return /\d+-\d+/.test(dk) || /\d{10,}/.test(inv.replace(/\s/g, ""));
  });
}
