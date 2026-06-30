import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { preprocessImageForOcr } from "@/lib/ocr/image-preprocess";
import { runOcrSpace } from "@/lib/ocr/ocrspace";
import { applyL1MProfile } from "@/lib/import/profiles/l1m-cargo-list-profile";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, calcBatchStats } from "@/lib/import/pipeline";
import { computeImageHash } from "@/lib/ocr/hash";
import { checkDailyLimit, logOcrUsage } from "@/lib/ocr/usage";
import type { CaptureMode, NormalizedDispatchRow } from "@/types/import";
import { isL1MLayout } from "@/lib/import/profiles/l1m-layout-detector";
import { extractL1MMetadata } from "@/lib/import/profiles/l1m-metadata-extractor";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { imageUrl, captureMode = "paper" } = await req.json() as { imageUrl: string; captureMode?: CaptureMode };
  if (!imageUrl) return NextResponse.json({ error: "imageUrl が必要です" }, { status: 400 });

  const limitCheck = await checkDailyLimit();
  if (!limitCheck.ok) return NextResponse.json({ error: `OCR.space 日次上限（${limitCheck.limit}回）到達` }, { status: 429 });

  const rawBuffer = await storageProvider.read(imageUrl);
  const buffer = await preprocessImageForOcr(rawBuffer);
  const imageHash = computeImageHash(rawBuffer);

  const ocrResult = await runOcrSpace(buffer);
  await logOcrUsage({ imageHash, status: "success", itemCount: 0 });

  // L1Mプロファイル判定
  let batchResult;
  if (isL1MLayout(ocrResult.parsedText, ocrResult.words)) {
    batchResult = await applyL1MProfile({
      parsedText: ocrResult.parsedText,
      words: ocrResult.words,
      imageWidth: ocrResult.imageWidth,
      imageHeight: ocrResult.imageHeight,
      source: captureMode === "paper" ? "camera_ocr" : "camera_ocr",
    });
  }

  if (!batchResult) {
    // 汎用OCRフォールバック（既存の index.ts を呼ぶことも可能）
    return NextResponse.json({ error: "L1M配車表を検出できませんでした。再撮影してください。" }, { status: 422 });
  }

  const batchId = await saveImportBatch(
    { ...batchResult, originalFileUrl: imageUrl },
    session.user.id
  );

  return NextResponse.json({ batchId, ...calcBatchStats(batchResult.rows), layoutProfile: batchResult.layoutProfile });
}
