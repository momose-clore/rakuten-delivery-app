import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { preprocessImageForOcr } from "@/lib/ocr/image-preprocess";
import { runOcrSpace } from "@/lib/ocr/ocrspace";
import { extractL1MWithGemini, isGeminiConfigured } from "@/lib/ocr/gemini";
import { applyL1MProfile } from "@/lib/import/profiles/l1m-cargo-list-profile";
import { saveImportBatch, saveDriverScan, calcBatchStats } from "@/lib/import/pipeline";
import { computeImageHash } from "@/lib/ocr/hash";
import { checkDailyLimit, logOcrUsage } from "@/lib/ocr/usage";
import type { CaptureMode } from "@/types/import";
import { isL1MLayout } from "@/lib/import/profiles/l1m-layout-detector";

export const maxDuration = 60;

/**
 * imageUrl が自前ストレージ（Vercel Blob）由来かを検証する SSRF ガード。
 * https かつ Vercel Blob のホスト（*.blob.vercel-storage.com）のみ許可。
 * ローカル開発の public/uploads 相対パス（/uploads/...）も許可する。
 */
function isAllowedStorageUrl(raw: string): boolean {
  // 開発用のローカル相対パス
  if (raw.startsWith("/uploads/")) return true;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  return u.hostname === "blob.vercel-storage.com" || u.hostname.endsWith(".blob.vercel-storage.com");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DRIVER")) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { imageUrl } = await req.json() as { imageUrl: string; captureMode?: CaptureMode };
  if (!imageUrl) return NextResponse.json({ error: "imageUrl が必要です" }, { status: 400 });
  // SSRF対策: 自ストレージ（Vercel Blob）由来のURLのみ許可し、
  // 任意URL（内部メタデータ等）をサーバに fetch させない。
  if (!isAllowedStorageUrl(imageUrl)) {
    return NextResponse.json({ error: "不正な imageUrl です" }, { status: 400 });
  }

  const rawBuffer = await storageProvider.read(imageUrl);
  const imageHash = computeImageHash(rawBuffer);

  // カメラ生写真は Gemini(画像AI) 優先で構造化抽出（斜め/横向き/密な表でも意味で読める）。
  // 未設定/失敗/0件のときは従来の OCR.space にフォールバック（PDFは別ルートで従来どおりOCR.space）。
  let batchResult: Awaited<ReturnType<typeof applyL1MProfile>> | null = null;
  if (isGeminiConfigured()) {
    try {
      batchResult = await extractL1MWithGemini(rawBuffer, "image/jpeg");
    } catch {
      batchResult = null;
    }
  }

  if (!batchResult) {
    // フォールバック: OCR.space（従来経路）
    const limitCheck = await checkDailyLimit();
    if (!limitCheck.ok) return NextResponse.json({ error: `OCR.space 日次上限（${limitCheck.limit}回）到達` }, { status: 429 });
    const buffer = await preprocessImageForOcr(rawBuffer);
    const ocrResult = await runOcrSpace(buffer);
    await logOcrUsage({ imageHash, status: "success", itemCount: 0 });
    if (isL1MLayout(ocrResult.parsedText, ocrResult.words)) {
      batchResult = await applyL1MProfile({
        parsedText: ocrResult.parsedText,
        words: ocrResult.words,
        imageWidth: ocrResult.imageWidth,
        imageHeight: ocrResult.imageHeight,
        source: "camera_ocr",
      });
    }
  }

  if (!batchResult) {
    return NextResponse.json({ error: "L1M配車表を検出できませんでした。再撮影してください。" }, { status: 422 });
  }

  // ドライバー自己スキャン：本人の本日配送として即反映（管理者確認スキップ）
  if (session.user.role === "DRIVER") {
    const driverId = session.user.driverId;
    if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });
    const { itemCount, createdCount, updatedCount } = await saveDriverScan(
      { ...batchResult, originalFileUrl: imageUrl },
      driverId,
      session.user.id,
      imageUrl
    );
    return NextResponse.json({ reflected: true, itemCount, createdCount, updatedCount, ...calcBatchStats(batchResult.rows), layoutProfile: batchResult.layoutProfile });
  }

  // 管理者：従来どおり取込バッチ→確認フロー
  const batchId = await saveImportBatch(
    { ...batchResult, originalFileUrl: imageUrl },
    session.user.id
  );

  return NextResponse.json({ batchId, ...calcBatchStats(batchResult.rows), layoutProfile: batchResult.layoutProfile });
}
