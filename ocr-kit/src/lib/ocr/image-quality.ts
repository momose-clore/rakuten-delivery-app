import sharp from "sharp";

export interface ImageQualityReport {
  score: number;              // 0-100
  resolution: "good" | "low";
  contrast: "good" | "low";
  blur: "good" | "blurry";
  skew: "none" | "slight" | "strong";
  brightness: "good" | "too_dark" | "too_bright";
  // 領域解析（OCR v6 追加）
  whiteBlowout: boolean;      // 反射・白飛び
  topShadow: boolean;         // 上部（ヘッダー）に影
  rightEdgeCutRisk: boolean;  // 右端が切れている可能性
  bottomBlankRatio: number;   // 下部の空白率（0-1）
  warnings: string[];
  processingMs?: number;
}

/**
 * 画像品質スコアを算出する（OCR実行前チェック用）。
 * 解析は縮小画像で行い高速化。解像度判定のみ原寸メタデータを使う。
 * OCR.space方針・1画像1回は不変（ここでは送信しない）。
 */
export async function assessImageQuality(buffer: Buffer): Promise<ImageQualityReport> {
  const start = Date.now();
  const warnings: string[] = [];

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // 解像度チェック（原寸で判定）
  const minDim = Math.min(width, height);
  const resolution: "good" | "low" = minDim >= 800 ? "good" : "low";
  if (resolution === "low") warnings.push(`解像度が低い（${width}×${height}px）。もう少し近づいて撮影してください。`);

  // 解析は縮小画像で（高速化）
  const { data: rawData, info } = await sharp(buffer)
    .greyscale()
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.length);
  const w = info.width;
  const h = info.height;
  const total = w * h;

  // 単一パスで各種統計・領域指標を収集
  let sum = 0, sumSq = 0;
  let topSum = 0, topCount = 0;
  let rightDark = 0, rightCount = 0;
  let clipCount = 0;              // 白飛び（255付近）
  let bottomBlank = 0, bottomCount = 0;
  const topRows = Math.max(1, Math.floor(h * 0.12));
  const rightColStart = Math.floor(w * 0.97);
  const bottomStart = Math.floor(h * 0.85);

  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    for (let x = 0; x < w; x++) {
      const p = pixels[rowBase + x];
      sum += p;
      sumSq += p * p;
      if (y < topRows) { topSum += p; topCount++; }
      if (x >= rightColStart) { rightCount++; if (p < 90) rightDark++; }
      if (p >= 254) clipCount++;
      if (y >= bottomStart) { bottomCount++; if (p >= 230) bottomBlank++; }
    }
  }

  const avgBrightness = sum / total;
  const stddev = Math.sqrt(sumSq / total - avgBrightness * avgBrightness);
  const topMean = topCount > 0 ? topSum / topCount : avgBrightness;
  const bottomBlankRatio = bottomCount > 0 ? bottomBlank / bottomCount : 0;

  // 明るさ
  const brightness: "good" | "too_dark" | "too_bright" =
    avgBrightness < 60 ? "too_dark" : avgBrightness > 220 ? "too_bright" : "good";
  if (brightness === "too_dark") warnings.push("画像が暗すぎます。明るい場所で撮影してください。");
  if (brightness === "too_bright") warnings.push("画像が明るすぎます。反射に注意して撮影してください。");

  // コントラスト
  const contrast: "good" | "low" = stddev > 40 ? "good" : "low";
  if (contrast === "low") warnings.push("コントラストが低く、文字が読みにくい可能性があります。");

  // 白飛び（反射）
  const whiteBlowout = clipCount / total > 0.12;
  if (whiteBlowout) warnings.push("反射・白飛びがあります。角度を変えて撮影してください。");

  // 上部の影（ヘッダーが暗い）
  const topShadow = topMean < avgBrightness * 0.72 && brightness !== "too_dark";
  if (topShadow) warnings.push("上部に影がかかっている可能性があります。影を避けて撮影してください。");

  // 右端切れ（右端に文字インクが密集）
  const rightEdgeCutRisk = rightCount > 0 && rightDark / rightCount > 0.14;
  if (rightEdgeCutRisk) warnings.push("右端が切れている可能性があります。表全体が入るように撮影してください。");

  // ぼやけ検出（ラプラシアン簡易）
  let lapSum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      lapSum += Math.abs(4 * pixels[idx] - pixels[idx - 1] - pixels[idx + 1] - pixels[idx - w] - pixels[idx + w]);
    }
  }
  const lapVariance = lapSum / ((w - 2) * (h - 2));
  const blur: "good" | "blurry" = lapVariance > 8 ? "good" : "blurry";
  if (blur === "blurry") warnings.push("画像がぼやけています。カメラを固定して撮影してください。");

  // 傾き推定（簡易）
  const aspectRatio = width / (height || 1);
  const skew: "none" | "slight" | "strong" =
    aspectRatio > 0.5 && aspectRatio < 2.5 ? "none" : "slight";

  // スコア
  let score = 100;
  if (resolution === "low") score -= 25;
  if (contrast === "low") score -= 15;
  if (blur === "blurry") score -= 20;
  if (brightness !== "good") score -= 15;
  if (whiteBlowout) score -= 10;
  if (topShadow) score -= 8;
  if (rightEdgeCutRisk) score -= 10;
  if (skew !== "none") score -= 5;
  score = Math.max(0, score);

  return {
    score, resolution, contrast, blur, skew, brightness,
    whiteBlowout, topShadow, rightEdgeCutRisk, bottomBlankRatio,
    warnings, processingMs: Date.now() - start,
  };
}
