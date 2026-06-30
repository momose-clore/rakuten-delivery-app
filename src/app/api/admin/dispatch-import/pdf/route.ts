// pdf-parse は DOMMatrix 等ブラウザAPIを参照するため dynamic に設定
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { parsePdfBuffer } from "@/lib/import/pdf/pdf-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, calcBatchStats } from "@/lib/import/pipeline";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
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

  const batchId = await saveImportBatch(
    { batchId: "", source, ...stats, rows: rescued, originalFileUrl: url },
    session.user.id
  );

  return NextResponse.json({ batchId, source, ...stats });
}
