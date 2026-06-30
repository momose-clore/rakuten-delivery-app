import sharp from "sharp";

/**
 * OCR前処理：画像品質を最適化して認識精度を向上
 * Vercel 10秒制限内に収まる処理のみ実施
 */
export async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 1000;
  const height = metadata.height ?? 1000;

  // 横向き画像は回転補正
  const needsRotation = metadata.orientation && metadata.orientation > 1;

  let pipeline = sharp(buffer);

  // EXIF 方向補正
  if (needsRotation) {
    pipeline = pipeline.rotate();
  }

  // 小さい画像は 2000px に拡大（長辺基準）
  const maxDim = Math.max(width, height);
  if (maxDim < 2000) {
    pipeline = pipeline.resize(null, null, {
      width: Math.round(width * (2000 / maxDim)),
      height: Math.round(height * (2000 / maxDim)),
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });
  }

  return pipeline
    .grayscale()
    .normalize()           // コントラスト自動調整
    .sharpen({ sigma: 1.2, m1: 1.0, m2: 0.5 })
    .jpeg({ quality: 92 })
    .toBuffer();
}
