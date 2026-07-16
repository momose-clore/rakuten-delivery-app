import type { OcrWord } from "./ocrspace";

export interface GridBounds {
  verticalLines: number[];   // x座標（ピクセル）の配列
  horizontalLines: number[]; // y座標（ピクセル）の配列
  detected: boolean;
}

/**
 * OCR単語の分布から罫線候補を推定する。
 * 実際の画像処理（エッジ検出）ではなく、単語の分布ギャップから推定する簡易版。
 * 失敗時は detected: false を返し、ヘッダーアンカー方式に fallback する。
 */
export function detectGrid(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number
): GridBounds {
  if (words.length < 10) return { verticalLines: [], horizontalLines: [], detected: false };

  // 縦罫線: x座標のヒストグラムでギャップを検出
  const xGap = detectGaps(
    words.flatMap((w) => [w.left, w.left + w.width]),
    imageWidth,
    20  // 最小ギャップ幅 px
  );

  // 横罫線: y座標のヒストグラムでギャップを検出
  const yGap = detectGaps(
    words.flatMap((w) => [w.top, w.top + w.height]),
    imageHeight,
    5   // 最小ギャップ幅 px
  );

  const detected = xGap.length >= 3; // 最低3本の縦罫線が必要
  return { verticalLines: xGap, horizontalLines: yGap, detected };
}

function detectGaps(coords: number[], maxDim: number, minGap: number): number[] {
  // ヒストグラムを作成（5px 単位）
  const binSize = 5;
  const bins = new Array(Math.ceil(maxDim / binSize)).fill(0);
  for (const c of coords) {
    const idx = Math.min(Math.floor(c / binSize), bins.length - 1);
    bins[idx]++;
  }

  // ゼロ（または低密度）の連続区間の中点を罫線候補とする
  const gaps: number[] = [];
  let inGap = false;
  let gapStart = 0;

  for (let i = 0; i < bins.length; i++) {
    if (bins[i] === 0) {
      if (!inGap) { inGap = true; gapStart = i; }
    } else {
      if (inGap) {
        const gapWidth = (i - gapStart) * binSize;
        if (gapWidth >= minGap) {
          gaps.push((gapStart + (i - gapStart) / 2) * binSize);
        }
        inGap = false;
      }
    }
  }

  return gaps;
}
