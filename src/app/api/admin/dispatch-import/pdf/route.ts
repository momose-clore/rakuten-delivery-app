// pdf-parse は DOMMatrix 等ブラウザAPIを参照するため dynamic に設定
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { parsePdfBuffer } from "@/lib/import/pdf/pdf-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, saveDriverScan, calcBatchStats } from "@/lib/import/pipeline";

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

  const { rows, source } = await parsePdfBuffer(buffer, waveNo);
  const rescued = await autoRescueRows(rows);
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
