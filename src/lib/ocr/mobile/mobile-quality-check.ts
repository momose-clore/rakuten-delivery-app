import { assessImageQuality, type ImageQualityReport } from "@/lib/ocr/image-quality";

export type MobileQualityLevel = "excellent" | "good" | "warning" | "bad" | "unusable";

export interface MobileImageQualityReport extends ImageQualityReport {
  level: MobileQualityLevel;
  blockingReasons: string[];
  canProceedToOcr: boolean;
  // L1M固有の警告
  rightEdgeCutRisk: boolean;
  shadowOnHeader: boolean;
  largeBottomMargin: boolean;
  backgroundNoise: boolean;
}

export async function assessMobileImageQuality(
  buffer: Buffer,
  captureMode: "screen" | "paper" = "paper"
): Promise<MobileImageQualityReport> {
  const base = await assessImageQuality(buffer);
  const warnings = [...base.warnings];
  const blockingReasons: string[] = [];

  // スマホ撮影固有の警告
  const rightEdgeCutRisk = false;  // TODO: 右端の単語密度で推定
  const shadowOnHeader = false;    // TODO: 上部のコントラスト分析
  const largeBottomMargin = false; // TODO: 下部の空白比率
  const backgroundNoise = base.contrast === "low";

  if (backgroundNoise) warnings.push("BACKGROUND_NOISE");
  if (base.blur === "blurry") {
    blockingReasons.push("画像がぼやけています。再撮影してください。");
  }
  if (base.brightness === "too_dark") {
    blockingReasons.push("画像が暗すぎます。明るい場所で撮影してください。");
  }
  if (base.resolution === "low") {
    warnings.push("TEXT_TOO_SMALL");
  }

  // captureMode 固有チェック
  if (captureMode === "screen") {
    if (base.contrast === "low") warnings.push("画面の明るさを上げてください。");
  }

  const level: MobileQualityLevel =
    blockingReasons.length > 0 ? "bad"
    : warnings.length === 0 ? "excellent"
    : warnings.length <= 2 ? "good"
    : "warning";

  return {
    ...base,
    level,
    blockingReasons,
    canProceedToOcr: blockingReasons.length === 0,
    rightEdgeCutRisk,
    shadowOnHeader,
    largeBottomMargin,
    backgroundNoise,
    warnings,
  };
}
