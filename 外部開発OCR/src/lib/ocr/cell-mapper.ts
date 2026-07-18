import type { GridBounds } from "./grid-detector";
import type { ColumnDef } from "./table-template";
import { L1M_COLUMNS } from "./table-template";

/**
 * グリッド検出結果を使って列定義を補正する。
 * 検出した縦罫線 x 座標と既存の列定義を照合し、
 * 列境界をグリッドに合わせて調整する。
 * グリッド未検出の場合は固定テンプレートをそのまま返す。
 */
export function calibrateColumnsByGrid(
  grid: GridBounds,
  imageWidth: number
): ColumnDef[] {
  if (!grid.detected || grid.verticalLines.length < 3) {
    return L1M_COLUMNS;
  }

  // 罫線を画像幅パーセントに変換
  const linePcts = grid.verticalLines
    .map((x) => (x / imageWidth) * 100)
    .sort((a, b) => a - b);

  // 既存の列定義と照合して境界を補正
  const calibrated = L1M_COLUMNS.map((col) => ({ ...col }));

  for (let i = 0; i < calibrated.length - 1; i++) {
    const col = calibrated[i];
    const nextCol = calibrated[i + 1];

    // この列の右端に最も近い罫線を探す
    const targetPct = col.xMax;
    const nearest = linePcts.reduce((best, line) =>
      Math.abs(line - targetPct) < Math.abs(best - targetPct) ? line : best
    , linePcts[0]);

    // 15% 以内にある場合だけ補正
    if (Math.abs(nearest - targetPct) < 15) {
      col.xMax = nearest;
      nextCol.xMin = nearest;
    }
  }

  return calibrated;
}
