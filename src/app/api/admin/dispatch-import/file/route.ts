import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { storageProvider } from "@/lib/storage";
import { parseCsvText } from "@/lib/import/csv/csv-parser";
import { parseExcelBuffer } from "@/lib/import/csv/excel-parser";
import { autoRescueRows } from "@/lib/import/auto-rescue";
import { saveImportBatch, calcBatchStats } from "@/lib/import/pipeline";
import type { DispatchImportSource } from "@/types/import";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const waveNo = formData.get("waveNo") as string | undefined;

  if (!file) return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  let rows;
  let source: DispatchImportSource = "csv";

  if (ext === "csv") {
    rows = parseCsvText(buffer.toString("utf-8"), waveNo);
    source = "csv";
  } else if (ext === "xlsx" || ext === "xls") {
    rows = parseExcelBuffer(buffer, waveNo);
    source = "excel";
  } else {
    return NextResponse.json({ error: "対応形式は CSV / XLSX / XLS です" }, { status: 400 });
  }

  // 自動救済
  const rescued = await autoRescueRows(rows);
  const stats = calcBatchStats(rescued);

  // ファイルを Vercel Blob に保存
  const filename = `import/${Date.now()}_${file.name}`;
  const { url } = await storageProvider.save(buffer, filename);

  const batchId = await saveImportBatch(
    { batchId: "", source, ...stats, rows: rescued, originalFileUrl: url },
    session.user.id
  );

  return NextResponse.json({ batchId, ...stats });
}
