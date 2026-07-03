// pdf-parse は DOMMatrix 等ブラウザAPIを参照するため dynamic に設定
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { parsePdfBuffer } from "@/lib/import/pdf/pdf-parser";
import { parsePasteText } from "@/lib/import/paste/paste-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, saveDriverScan, calcBatchStats } from "@/lib/import/pipeline";
import { runOcrSpace } from "@/lib/ocr/ocrspace";
import { preprocessImageForOcr } from "@/lib/ocr/image-preprocess";
import { extractLargestJpegFromPdf } from "@/lib/import/pdf/extract-pdf-image";
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
  let rescued: NormalizedDispatchRow[] = [];
  let source: "pdf_text" | "pdf_ocr" = parsed.source;

  if (parsed.rows.length > 0) {
    // テキストレイヤーあり
    rescued = await autoRescueRows(parsed.rows);
  } else {
    // スキャンPDF（CamScanner等・テキストなし）→ OCR.space に通す
    const limit = await checkDailyLimit();
    if (!limit.ok) return NextResponse.json({ error: `OCR.space 日次上限（${limit.limit}回）到達` }, { status: 429 });

    // スキャンPDFは埋め込み画像を取り出して「画像OCR（Engine2）」に回すと座標が安定し
    // 配車No等の復元精度が上がる（実データで確認）。抽出できなければ従来の PDF→Engine1。
    // いずれも OCR.space 送信は1回のみ（多重送信しない）。
    const embeddedImage = extractLargestJpegFromPdf(buffer);
    let ocr;
    try {
      if (embeddedImage) {
        const pre = await preprocessImageForOcr(embeddedImage);
        ocr = await runOcrSpace(pre, "image/jpeg");
      } else {
        ocr = await runOcrSpace(buffer, "application/pdf");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "不明なエラー";
      return NextResponse.json({ error: `OCR処理に失敗しました（${msg}）` }, { status: 502 });
    }
    await logOcrUsage({ imageHash: computeImageHash(buffer), status: "success", itemCount: 0 });
    source = "pdf_ocr";

    // 座標が取れていれば L1M 座標復元、弱ければ OCR テキストのパースにフォールバック
    if (ocr.words.length > 0 && isL1MLayout(ocr.parsedText, ocr.words)) {
      const batch = await applyL1MProfile({
        parsedText: ocr.parsedText, words: ocr.words,
        imageWidth: ocr.imageWidth, imageHeight: ocr.imageHeight, source: "image_ocr",
      });
      rescued = batch ? batch.rows : [];
    }
    if (rescued.length === 0 && ocr.parsedText.trim().length > 0) {
      const textRows = parsePasteText(ocr.parsedText, waveNo).map((r) => ({ ...r, source: "pdf_ocr" as const }));
      rescued = await autoRescueRows(textRows);
    }
    if (rescued.length === 0) {
      const chars = ocr.parsedText.replace(/\s/g, "").length;
      return NextResponse.json({ error: `配送表を読み取れませんでした（認識文字数: ${chars}）。1ページ・正面・明るい場所で撮り直してください。` }, { status: 422 });
    }
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
