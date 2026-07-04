/**
 * 射影変換（ホモグラフィ）ユーティリティ。
 * カメラで斜めに撮られた配送表を、ユーザーが指定した4隅から平面（長方形）に補正する。
 * ブラウザ(canvas)でもNode(検証)でも使える純関数を提供する。
 */

export type Point = { x: number; y: number };

/**
 * 4点対応 from→to からホモグラフィ行列(3x3, 9要素・行優先)を解く。
 * 8元連立をガウス消去で解く。
 */
export function solveHomography(from: Point[], to: Point[]): number[] {
  // A h = b （h は8未知数 [a,b,c,d,e,f,g,h]、i=1固定）
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: X, y: Y } = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = gaussianSolve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** 点 (x,y) にホモグラフィ H を適用 */
export function applyHomography(H: number[], x: number, y: number): Point {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

/** ガウス消去法で n×n 連立を解く（部分ピボット選択） */
function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const pv = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / pv;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1e-12));
}

/** 4隅の縦横比から出力サイズを推定（歪みを均す） */
export function estimateOutputSize(corners: Point[]): { width: number; height: number } {
  const [tl, tr, br, bl] = corners;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const w = Math.max(dist(tl, tr), dist(bl, br));
  const h = Math.max(dist(tl, bl), dist(tr, br));
  return { width: Math.round(w), height: Math.round(h) };
}
