import sharp from "sharp";

export interface ImageQualityReport {
  score: number;              // 0-100
  resolution: "good" | "low";
  contrast: "good" | "low";
  blur: "good" | "blurry";
  skew: "none" | "slight" | "strong";
  brightness: "good" | "too_dark" | "too_bright";
  warnings: string[];
  processingMs?: number;
}

/**
 * 画像品質スコアを算出する。
 * OCR実行前に呼んで、スコアが低い場合はユーザーに再撮影を促す。
 */
export async function assessImageQuality(buffer: Buffer): Promise<ImageQualityReport> {
  const start = Date.now();
  const warnings: string[] = [];

  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // 解像度チェック
  const minDim = Math.min(width, height);
  const resolution: "good" | "low" = minDim >= 800 ? "good" : "low";
  if (resolution === "low") warnings.push(`解像度が低い（${width}×${height}px）。より高解像度で撮影してください。`);

  // 画像の統計情報を取得（グレースケールで）
  const { data: rawData, info } = await image
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawData.buffer);
  const total = pixels.length;

  // 明るさ（平均輝度）
  const avgBrightness = pixels.reduce((s, p) => s + p, 0) / total;
  const brightness: "good" | "too_dark" | "too_bright" =
    avgBrightness < 60 ? "too_dark" : avgBrightness > 220 ? "too_bright" : "good";
  if (brightness === "too_dark") warnings.push("画像が暗すぎます。明るい場所で撮影してください。");
  if (brightness === "too_bright") warnings.push("画像が明るすぎます。反射に注意して撮影してください。");

  // コントラスト（標準偏差）
  const mean = avgBrightness;
  const variance = pixels.reduce((s, p) => s + (p - mean) ** 2, 0) / total;
  const stddev = Math.sqrt(variance);
  const contrast: "good" | "low" = stddev > 40 ? "good" : "low";
  if (contrast === "low") warnings.push("コントラストが低い。文字が読みにくい可能性があります。");

  // ぼやけ検出（ラプラシアン分散の簡易推定）
  // 隣接ピクセルの差分の分散を計算
  let lapSum = 0;
  const w = info.width;
  const h = info.height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap = Math.abs(
        4 * pixels[idx] -
        pixels[idx - 1] - pixels[idx + 1] -
        pixels[idx - w] - pixels[idx + w]
      );
      lapSum += lap;
    }
  }
  const lapVariance = lapSum / ((w - 2) * (h - 2));
  const blur: "good" | "blurry" = lapVariance > 8 ? "good" : "blurry";
  if (blur === "blurry") warnings.push("画像がぼやけています。カメラを固定して撮影してください。");

  // 傾き推定（簡易）- アスペクト比から大まかに判断
  const aspectRatio = width / height;
  const skew: "none" | "slight" | "strong" =
    aspectRatio > 0.5 && aspectRatio < 2.5 ? "none" : ("slight" as "none" | "slight" | "strong");

  // スコア計算
  let score = 100;
  if (resolution === "low") score -= 25;
  if (contrast === "low") score -= 15;
  if (blur === "blurry") score -= 20;
  if (brightness !== "good") score -= 15;
  if (skew !== "none") score -= 5;
  score = Math.max(0, score);

  return {
    score,
    resolution,
    contrast,
    blur,
    skew,
    brightness,
    warnings,
    processingMs: Date.now() - start,
  };
}
