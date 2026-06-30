import type { OcrWord } from "./ocrspace";
import type { TableRegion } from "./table-detector";
import { toRelativeX } from "./table-detector";
import { calibrateColumnsByHeader, getColumnByXPct, type FieldName } from "./table-template";

export interface MappedRow {
  rowIndex: number;
  yCenter: number;
  cells: Partial<Record<FieldName, string[]>>;
  isDataRow: boolean;
}

function medianWordHeight(words: OcrWord[]): number {
  if (words.length === 0) return 15;
  const heights = words.map((w) => w.height).sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 2)];
}

export function mapWordsToRows(
  words: OcrWord[],
  imageWidth: number,
  _imageHeight: number,
  region?: TableRegion | null
): MappedRow[] {
  if (words.length === 0) return [];

  const tableWords = region
    ? words.filter(
        (w) =>
          w.left >= region.xMin - 5 && w.left + w.width <= region.xMax + 5 &&
          w.top >= region.yMin - 5 && w.top <= region.yMax + 5
      )
    : words;

  if (tableWords.length === 0) return [];

  const toRelX = region
    ? (px: number) => toRelativeX(px, region)
    : (px: number) => (px / imageWidth) * 100;

  const calibratedColumns = calibrateColumnsByHeader(tableWords, toRelX);

  const wordHeight = medianWordHeight(tableWords);
  const tolerance = Math.max(wordHeight * 0.8, 8);

  const sorted = [...tableWords].sort((a, b) => a.top - b.top);
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

  const rawRows = rowGroups.map((group, idx) => {
    const yCenter = group.reduce((s, w) => s + w.top + w.height / 2, 0) / group.length;
    const cells: Partial<Record<FieldName, string[]>> = {};

    for (const word of [...group].sort((a, b) => a.left - b.left)) {
      const xRelCenter = toRelX(word.left + word.width / 2);
      const col = getColumnByXPct(xRelCenter, calibratedColumns);
      if (col) {
        if (!cells[col.name]) cells[col.name] = [];
        cells[col.name]!.push(word.text);
      }
    }

    const isDataRow = isDispatchRow(cells);
    return { rowIndex: idx, yCenter, cells, isDataRow };
  });

  return mergeAddressContinuationRows(rawRows);
}

function isDispatchRow(cells: Partial<Record<FieldName, string[]>>): boolean {
  const dk = (cells.dispatchKey ?? []).join("");
  const inv = (cells.invoiceNo ?? []).join("");
  return /\d+-\d+/.test(dk) || /\d{10,}/.test(inv.replace(/\s/g, ""));
}

function mergeAddressContinuationRows(rows: MappedRow[]): MappedRow[] {
  const result: MappedRow[] = [];
  for (const row of rows) {
    if (row.isDataRow || result.length === 0) {
      result.push(row);
      continue;
    }
    const prev = result[result.length - 1];
    const extra = row.cells.address ?? row.cells.memo ?? [];
    if (extra.length > 0) {
      if (!prev.cells.address) prev.cells.address = [];
      prev.cells.address.push(...extra);
    }
  }
  return result;
}

export function filterDataRows(rows: MappedRow[]): MappedRow[] {
  return rows.filter((r) => r.isDataRow);
}
