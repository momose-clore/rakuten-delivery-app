import sharp from "sharp";

/**
 * OCR前処理（設定可能・高解像度化）— OCR.space方針・1画像1回は不変。
 * ここでは「1枚の処理済み画像」を作るだけ。送信は呼び出し側で1回のみ。
 *
 * 環境変数（本番調整用・未設定時は既定値）:
 *   OCR_PREPROCESS_TARGET_LONG_EDGE  既定 3600
 *   OCR_PREPROCESS_MAX_LONG_EDGE     既定 4200
 *   OCR_PREPROCESS_ENABLE_UPSCALE    既定 true
 *   OCR_PREPROCESS_ENABLE_SHARPEN    既定 true
 *   OCR_PREPROCESS_ENABLE_CONTRAST   既定 true
 *   OCR_PREPROCESS_ENABLE_DESKEW     既定 true（EXIF回転補正）
 */

export interface PreprocessMeta {
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  upscaleRatio: number;
  steps: string[];
}

function numEnv(key: string, def: number): number {
  const v = parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}
function boolEnv(key: string, def: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return def;
  return v !== "false" && v !== "0";
}

/** 詳細版：処理済みバッファ＋前処理メタデータを返す */
export async function preprocessImageForOcrDetailed(buffer: Buffer): Promise<{ buffer: Buffer; meta: PreprocessMeta }> {
  // 潰れた小さい文字（伝票No・数量）対策で解像度を優先。実機の高解像度写真を
  // むやみに縮小しないよう MAX を大きく取り、実質の上限は送信ペイロード(1MB)側で調整する
  // （grayscaleなら6000px級でも1MB以下に収まることを実測済み）。
  const TARGET = numEnv("OCR_PREPROCESS_TARGET_LONG_EDGE", 4000);
  const MAX = numEnv("OCR_PREPROCESS_MAX_LONG_EDGE", 6000);
  const ENABLE_UPSCALE = boolEnv("OCR_PREPROCESS_ENABLE_UPSCALE", true);
  const ENABLE_SHARPEN = boolEnv("OCR_PREPROCESS_ENABLE_SHARPEN", true);
  const ENABLE_CONTRAST = boolEnv("OCR_PREPROCESS_ENABLE_CONTRAST", true);
  const ENABLE_DESKEW = boolEnv("OCR_PREPROCESS_ENABLE_DESKEW", true);

  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 1000;
  const originalHeight = metadata.height ?? 1000;
  const maxDim = Math.max(originalWidth, originalHeight);
  const steps: string[] = [];

  let pipeline = sharp(buffer);
  if (ENABLE_DESKEW) { pipeline = pipeline.rotate(); steps.push("exif-rotate"); }  // EXIF方向補正

  // 目標長辺へリサイズ（小さければ拡大／大きすぎれば縮小）
  let processedWidth = originalWidth;
  let processedHeight = originalHeight;
  let upscaleRatio = 1;
  if (ENABLE_UPSCALE && maxDim < TARGET) {
    upscaleRatio = TARGET / maxDim;
    processedWidth = Math.round(originalWidth * upscaleRatio);
    processedHeight = Math.round(originalHeight * upscaleRatio);
    pipeline = pipeline.resize(processedWidth, processedHeight, { kernel: sharp.kernel.lanczos3 });
    steps.push(`upscale x${upscaleRatio.toFixed(2)}→${TARGET}px`);
  } else if (maxDim > MAX) {
    upscaleRatio = MAX / maxDim;
    processedWidth = Math.round(originalWidth * upscaleRatio);
    processedHeight = Math.round(originalHeight * upscaleRatio);
    pipeline = pipeline.resize(processedWidth, processedHeight, { kernel: sharp.kernel.lanczos3 });
    steps.push(`downscale→${MAX}px`);
  }

  pipeline = pipeline.grayscale();
  steps.push("grayscale");
  if (ENABLE_CONTRAST) {
    pipeline = pipeline.normalize().clahe({ width: 128, height: 128, maxSlope: 3 });
    steps.push("normalize", "clahe");
  }
  if (ENABLE_SHARPEN) {
    pipeline = pipeline.sharpen({ sigma: 1.4 });
    steps.push("sharpen");
  }

  // 高解像度化でペイロードが膨らむため品質は88（罫線と文字が潰れない範囲）
  let out = await pipeline.jpeg({ quality: 88 }).toBuffer();

  // OCR.space送信ペイロード保護：上限を超える場合は段階的に品質→解像度を落として収める（送信は依然1回）
  // 無料枠は1画像1MB制限のため OCR_MAX_PAYLOAD_MB=1 を推奨（既定3.5=PRO想定）。
  const maxPayload = Math.round(numEnv("OCR_MAX_PAYLOAD_MB", 3.5) * 1_000_000);
  if (out.length > maxPayload) {
    // 潰れた小さい文字を守るため「解像度優先」：まず品質を大きく落として収める。
    for (const q of [78, 68, 58, 50, 44]) {
      if (out.length <= maxPayload) break;
      out = await sharp(out).jpeg({ quality: q }).toBuffer();
    }
    // 品質だけで収まらない場合のみ長辺を段階縮小（下限 2400px＝小数字が潰れない範囲）
    let guardWidth = processedWidth;
    while (out.length > maxPayload && guardWidth > 2400) {
      guardWidth = Math.round(guardWidth * 0.88);
      out = await sharp(out).resize({ width: guardWidth }).jpeg({ quality: 50 }).toBuffer();
    }
    steps.push(`payload-guard→${(out.length / 1_000_000).toFixed(2)}MB`);
  }

  return {
    buffer: out,
    meta: { originalWidth, originalHeight, processedWidth, processedHeight, upscaleRatio: Number(upscaleRatio.toFixed(3)), steps },
  };
}

/** 従来シグネチャ（処理済みバッファのみ）— 後方互換 */
export async function preprocessImageForOcr(buffer: Buffer): Promise<Buffer> {
  const { buffer: out } = await preprocessImageForOcrDetailed(buffer);
  return out;
}
