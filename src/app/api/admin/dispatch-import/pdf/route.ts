// pdf-parse は DOMMatrix 等ブラウザAPIを参照するため dynamic に設定
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { parsePdfBuffer } from "@/lib/import/pdf/pdf-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, saveDriverScan, calcBatchStats } from "@/lib/import/pipeline";
import { runOcrSpace } from "@/lib/ocr/ocrspace";
import { applyL1MProfile } from "@/lib/import/profiles/l1m-cargo-list-profile";
import { isL1MLayout } from "@/lib/import/profiles/l1m-layout-detector";
import { checkDailyLimit, logOcrUsage } from "@/lib/ocr/usage";
import { computeImageHash } from "@/lib/ocr/hash";
import type { NormalizedDispatchRow } from "@/types/import";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DRIVER")) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const waveNo = formData.get("waveNo") as string | undefined;

  if (!file) return NextResponse.json({ error: "PDFファイルが必要です" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf") return NextResponse.json({ error: ".pdf のみ対応しています" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Vercel Blob に保存（個人情報含むため公開URLにしない設計）
  const filename = `import/pdf/${Date.now()}_${file.name}`;
  const { url } = await storageProvider.save(buffer, filename);

  const parsed = await parsePdfBuffer(buffer, waveNo);
  let rescued: NormalizedDispatchRow[];
  let source: "pdf_text" | "pdf_ocr" = parsed.source;

  if (parsed.rows.length > 0) {
    // テキストレイヤーあり
    rescued = await autoRescueRows(parsed.rows);
  } else {
    // スキャンPDF（CamScanner等・テキストなし）→ OCR.space に通す
    const limit = await checkDailyLimit();
    if (!limit.ok) return NextResponse.json({ error: `OCR.space 日次上限（${limit.limit}回）到達` }, { status: 429 });
    const ocr = await runOcrSpace(buffer, "application/pdf");
    await logOcrUsage({ imageHash: computeImageHash(buffer), status: "success", itemCount: 0 });
    if (!isL1MLayout(ocr.parsedText, ocr.words)) {
      return NextResponse.json({ error: "配送表（L1M）を検出できませんでした。1ページ・正面・鮮明なPDFをお試しください。" }, { status: 422 });
    }
    const batch = await applyL1MProfile({
      parsedText: ocr.parsedText, words: ocr.words,
      imageWidth: ocr.imageWidth, imageHeight: ocr.imageHeight, source: "image_ocr",
    });
    if (!batch) {
      return NextResponse.json({ error: "配送表を解析できませんでした。1ページ・正面・鮮明なPDFをお試しください。" }, { status: 422 });
    }
    rescued = batch.rows;
    source = "pdf_ocr";
  }

  const stats = calcBatchStats(rescued);
  const result = { batchId: "", source, ...stats, rows: rescued, originalFileUrl: url, waveNo: waveNo ?? undefined };

  // ドライバー自己取込：本人の本日配送として即反映
  if (session.user.role === "DRIVER") {
    const driverId = session.user.driverId;
    if (!driverId) return NextResponse.json({ error: "ドライバー情報が見つかりません" }, { status: 403 });
    if (rescued.length === 0) return NextResponse.json({ error: "配送データを読み取れませんでした。別のPDFをお試しください。" }, { status: 422 });
    const { itemCount } = await saveDriverScan(result, driverId, session.user.id, url);
    return NextResponse.json({ reflected: true, itemCount, source, ...stats });
  }

  // 管理者：従来どおり取込バッチ→確認フロー
  const batchId = await saveImportBatch(result, session.user.id);

  return NextResponse.json({ batchId, source, ...stats });
}
