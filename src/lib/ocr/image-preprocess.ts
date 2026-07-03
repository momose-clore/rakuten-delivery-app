import sharp from "sharp";

/**
 * OCR前処理：画像品質を最適化して認識精度を向上（OCR.space方針・1画像1回は不変）
 *
 * カメラ写真（不均一な明るさ・小さい文字）に効く処理：
 *  - EXIF回転補正 / 長辺を2600pxへ高解像度化（過大画像は3400pxへ縮小）
 *  - グレースケール + normalize + CLAHE(局所コントラスト) + シャープ化
 * Vercel 実行時間内（maxDuration=60）に収まる範囲。
 */
export async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 1000;
  const height = metadata.height ?? 1000;
  const maxDim = Math.max(width, height);

  const TARGET = 2600;   // 文字がつぶれないよう高解像度化
  const MAX = 3400;      // 大きすぎる写真はペイロード削減のため縮小

  // rotate() は引数なしで EXIF 方向を自動補正
  let pipeline = sharp(buffer).rotate();

  if (maxDim < TARGET) {
    const scale = TARGET / maxDim;
    pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale), { kernel: sharp.kernel.lanczos3 });
  } else if (maxDim > MAX) {
    const scale = MAX / maxDim;
    pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale), { kernel: sharp.kernel.lanczos3 });
  }

  return pipeline
    .grayscale()
    .normalize()                              // 全体コントラスト
    .clahe({ width: 128, height: 128, maxSlope: 3 })  // 局所コントラスト（影・反射に強い）
    .sharpen({ sigma: 1.5 })
    .jpeg({ quality: 95 })
    .toBuffer();
}
